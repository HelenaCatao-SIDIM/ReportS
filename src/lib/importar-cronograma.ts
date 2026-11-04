/**
 * Importação do cronograma por planilha Excel: regras puras, sem banco, compartilhadas entre servidor e navegador.
 *
 * Fluxo: o servidor lê a planilha (`lerLinhas`), o navegador mostra a prévia e junta as decisões do usuário
 * (cadastrar ou alterar o que não existe, corrigir atividade e prazo, pular) com `resolverLinhas`, e o servidor
 * confere tudo de novo antes de gravar. Quem grava nunca confia no que veio do navegador.
 */
import { normalizar } from "@/lib/format";
import { prazoValido } from "@/lib/cronograma";
import { similaridade } from "@/lib/similaridade";
import { TIPOS_VISITA } from "@/lib/visitas";
import type { TipoVisita } from "@/lib/types";

export const LIMITE_LINHAS = 500;
export const LIMITE_NOME = 120;
export const LIMITE_OBSERVACAO = 500;
/** Parecido o bastante para sugerir "era este?" quando o nome da planilha não existe. */
const LIMITE_SUGESTAO = 0.6;

/** Nome sem acento, caixa nem espaço repetido: serve para comparar o que vem da planilha com o cadastro. */
export const chaveNome = (s: string) => normalizar(s).replace(/\s+/g, " ");

// ---------- Leitura da planilha ----------

type ChaveColuna = "cliente" | "sistema" | "estabelecimento" | "setor" | "atividade" | "prazo" | "observacao";

export const COLUNAS: { chave: ChaveColuna; rotulo: string; obrigatoria: boolean; apelidos: string[]; exemplo: string }[] = [
  { chave: "cliente", rotulo: "Cliente", obrigatoria: true, apelidos: ["cliente"], exemplo: "Prefeitura de Vale Verde" },
  { chave: "sistema", rotulo: "Sistema", obrigatoria: true, apelidos: ["sistema"], exemplo: "SCA" },
  { chave: "estabelecimento", rotulo: "Estabelecimento", obrigatoria: true, apelidos: ["estabelecimento", "unidade"], exemplo: "Sede" },
  { chave: "setor", rotulo: "Setor", obrigatoria: false, apelidos: ["setor"], exemplo: "Protocolo" },
  { chave: "atividade", rotulo: "Atividade", obrigatoria: true, apelidos: ["atividade", "tipo", "tipo de visita"], exemplo: "Treinamento" },
  { chave: "prazo", rotulo: "Prazo", obrigatoria: true, apelidos: ["prazo", "data limite", "data"], exemplo: "13/11/2026" },
  { chave: "observacao", rotulo: "Observação", obrigatoria: false, apelidos: ["observacao", "observacoes", "observacao interna"], exemplo: "Combinado com o secretário" },
];

const chaveCabecalho = (s: string) =>
  normalizar(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export interface LinhaBruta {
  /** Número da linha na planilha (a primeira linha é o cabeçalho). */
  linha: number;
  cliente: string;
  sistema: string;
  estabelecimento: string;
  setor: string;
  atividadeTexto: string;
  atividade: TipoVisita | null;
  prazoTexto: string;
  prazo: string | null;
  observacao: string;
}

export interface LeituraPlanilha {
  linhas: LinhaBruta[];
  /** Colunas da planilha que o cronograma não usa (ignoradas, com aviso). */
  avisos: string[];
  /** Problema que impede de continuar (arquivo vazio, coluna obrigatória faltando, linhas demais). */
  erro?: string;
}

const vazia = (c: unknown) => c === null || c === undefined || (typeof c === "string" && !c.trim());

function textoCelula(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  if (typeof c === "boolean") return "";
  return String(c).trim().replace(/\s+/g, " ");
}

/** Data de uma célula: data do Excel, número de série, "13/11/2026", "13-11-26" ou "2026-11-13". Nulo se não for data. */
export function lerPrazo(c: unknown): string | null {
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null;
    const iso = c.toISOString().slice(0, 10);
    return prazoValido(iso) ? iso : null;
  }
  if (typeof c === "number") {
    // Número de série do Excel (dias desde 30/12/1899), só dentro de uma faixa que faça sentido como data.
    if (!Number.isInteger(c) || c < 20000 || c > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + c * 86_400_000).toISOString().slice(0, 10);
  }
  const t = textoCelula(c);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  let ano: string, mes: string, dia: string;
  if (m) [, ano, mes, dia] = m;
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
    if (!m) return null;
    [, dia, mes, ano] = m;
    if (ano.length === 2) ano = `20${ano}`;
  }
  const iso = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  return prazoValido(iso) ? iso : null;
}

/** Atividade pelo nome ("Treinamento online") ou pelo código ("treinamento_online"). Nulo se não reconhece. */
export function lerAtividade(texto: string): TipoVisita | null {
  const k = chaveCabecalho(texto);
  if (!k) return null;
  return TIPOS_VISITA.find((t) => chaveCabecalho(t.label) === k || chaveCabecalho(t.valor) === k)?.valor ?? null;
}

/**
 * Lê as células da primeira aba. A primeira linha com algo é o cabeçalho; as colunas são reconhecidas pelo nome
 * (sem diferenciar acento nem maiúsculas) e podem estar em qualquer ordem. Colunas desconhecidas são ignoradas.
 */
export function lerLinhas(dados: unknown[][]): LeituraPlanilha {
  const inicio = dados.findIndex((l) => l.some((c) => !vazia(c)));
  if (inicio < 0) return { linhas: [], avisos: [], erro: "A planilha está vazia." };

  const indices = new Map<ChaveColuna, number>();
  const avisos: string[] = [];
  dados[inicio].forEach((c, i) => {
    const nome = textoCelula(c);
    if (!nome) return;
    const coluna = COLUNAS.find((x) => x.apelidos.includes(chaveCabecalho(nome)));
    if (coluna && !indices.has(coluna.chave)) indices.set(coluna.chave, i);
    else if (!coluna) {
      avisos.push(
        chaveCabecalho(nome) === "equipe"
          ? "A coluna “Equipe” foi ignorada: o cronograma usa o Setor do estabelecimento (o cadastro Equipes é outra coisa)."
          : `A coluna “${nome}” foi ignorada: o cronograma não usa essa informação.`,
      );
    }
  });
  const faltando = COLUNAS.filter((c) => c.obrigatoria && !indices.has(c.chave)).map((c) => c.rotulo);
  if (faltando.length) return { linhas: [], avisos, erro: `Faltam colunas obrigatórias na primeira linha: ${faltando.join(", ")}.` };

  const linhas: LinhaBruta[] = [];
  for (let i = inicio + 1; i < dados.length; i++) {
    const row = dados[i];
    if (!row.some((c) => !vazia(c))) continue;
    const cel = (k: ChaveColuna) => (indices.has(k) ? row[indices.get(k)!] : undefined);
    const atividadeTexto = textoCelula(cel("atividade"));
    linhas.push({
      linha: i + 1,
      cliente: textoCelula(cel("cliente")),
      sistema: textoCelula(cel("sistema")),
      estabelecimento: textoCelula(cel("estabelecimento")),
      setor: textoCelula(cel("setor")),
      atividadeTexto,
      atividade: lerAtividade(atividadeTexto),
      prazoTexto: textoCelula(cel("prazo")),
      prazo: lerPrazo(cel("prazo")),
      observacao: textoCelula(cel("observacao")),
    });
    if (linhas.length > LIMITE_LINHAS) return { linhas: [], avisos, erro: `A planilha tem mais de ${LIMITE_LINHAS} linhas. Divida em planilhas menores.` };
  }
  if (!linhas.length) return { linhas, avisos, erro: "A planilha só tem o cabeçalho, sem nenhuma linha de dados." };
  return { linhas, avisos };
}

// ---------- Contexto (o que existe no sistema) ----------

export interface ContratoCtx {
  id: string;
  clienteId: string;
  clienteNome: string;
  sistemaCodigo: string;
  sistemaNome: string;
  tenantId: string | null;
  /** Contrato ativo de cliente ativo: só esse recebe item novo. */
  ativo: boolean;
}

export interface UnidadeCtx {
  id: string;
  nome: string;
  setores: { id: string; nome: string }[];
}

export interface ItemExistente {
  contratoId: string;
  unidadeId: string;
  setorId: string | null;
  tipo: TipoVisita;
}

export interface ContextoImportacao {
  contratos: ContratoCtx[];
  /** Estabelecimentos e setores por cliente. */
  unidades: Record<string, UnidadeCtx[]>;
  /** Itens ativos que já existem (para marcar o que seria duplicado). */
  existentes: ItemExistente[];
}

/** "Prefeitura de Vale Verde — SCA", com o tenant quando o mesmo cliente tem dois contratos do mesmo sistema. */
export function rotuloContrato(c: ContratoCtx, todos: ContratoCtx[]): string {
  const base = `${c.clienteNome} — ${c.sistemaNome}`;
  const repetido = todos.filter((x) => x.clienteId === c.clienteId && x.sistemaCodigo === c.sistemaCodigo).length > 1;
  return repetido && c.tenantId ? `${base} (tenant ${c.tenantId})` : base;
}

// ---------- Decisões do usuário e resolução de cada linha ----------

export type Decisao = { acao: "cadastrar" } | { acao: "usar"; id: string };

export interface Decisoes {
  /** Linhas que o usuário escolheu não importar. */
  pular: Record<number, boolean>;
  /** Contrato escolhido para a linha, quando a planilha não bateu com um só. */
  contrato: Record<number, string>;
  /** Correções de atividade e prazo feitas na tela. */
  atividade: Record<number, TipoVisita>;
  prazo: Record<number, string>;
  /** Para cada estabelecimento da planilha que não existe: cadastrar ou usar um existente. Chave: `chaveEstab`. */
  estab: Record<string, Decisao>;
  /** Idem para cada setor que não existe. Chave: `chaveSetor`. */
  setor: Record<string, Decisao>;
}

export const decisoesVazias = (): Decisoes => ({ pular: {}, contrato: {}, atividade: {}, prazo: {}, estab: {}, setor: {} });

export const chaveEstab = (clienteId: string, nome: string) => `${clienteId}|${chaveNome(nome)}`;
export const chaveSetor = (refUnidade: string, nome: string) => `${refUnidade}|${chaveNome(nome)}`;

export type RefUnidade = { tipo: "existente"; id: string; nome: string } | { tipo: "nova"; nome: string; chave: string };
/** `null` = todos os setores. */
export type RefSetor = null | { tipo: "existente"; id: string; nome: string } | { tipo: "novo"; nome: string; chave: string };

export interface Pergunta {
  campo: "estabelecimento" | "setor";
  /** Nome como veio da planilha. */
  nome: string;
  /** Chave da decisão (estab ou setor). */
  chave: string;
  /** Onde: nome do cliente (estabelecimento) ou do estabelecimento (setor). */
  onde: string;
  /** Opções para "alterar para um existente". */
  existentes: { id: string; nome: string }[];
  /** O existente mais parecido, se houver. */
  sugerido: string | null;
  /** Linhas que usam este nome. */
  linhas: number[];
  /** O que o usuário respondeu; nulo enquanto não respondeu. A pergunta respondida continua na tela, para poder mudar. */
  decisao: Decisao | null;
}

export type SituacaoLinha = "pronta" | "decidir" | "erro" | "duplicada" | "pulada";

/** Os campos de um item, na ordem em que a revisão os mostra (um aparece quando o anterior está resolvido). */
export type CampoItem = "contrato" | "estabelecimento" | "setor" | "atividade" | "prazo";
export const ORDEM_CAMPOS: readonly CampoItem[] = ["contrato", "estabelecimento", "setor", "atividade", "prazo"];

export interface LinhaResolvida {
  bruta: LinhaBruta;
  situacao: SituacaoLinha;
  contrato: ContratoCtx | null;
  /** Contratos entre os quais o usuário pode escolher quando a planilha não bateu com um só. */
  contratoOpcoes: ContratoCtx[];
  unidade: RefUnidade | null;
  setor: RefSetor | undefined;
  atividade: TipoVisita | null;
  prazo: string | null;
  observacao: string;
  /** Todos os problemas da linha (os que se corrigem na tela e os que não). */
  problemas: string[];
  /** Os problemas que se corrigem na tela, por campo (escolher o contrato, a atividade ou o prazo). */
  problemaDoCampo: Partial<Record<CampoItem, string>>;
  /** Os que não têm conserto na tela (nome em branco ou grande demais, observação grande): só pulando a linha. */
  semConserto: string[];
  perguntas: Pergunta[];
  /** Por que não será importada, quando `duplicada`. */
  motivoDuplicada?: string;
}

/** Problemas da planilha que a tela não consegue corrigir: o texto vem do Excel e só se muda lá. */
function problemasSemConserto(b: LinhaBruta): string[] {
  const p: string[] = [];
  if (b.observacao.length > LIMITE_OBSERVACAO) p.push(`Observação com mais de ${LIMITE_OBSERVACAO} caracteres.`);
  if (!b.estabelecimento) p.push("Estabelecimento em branco.");
  else if (b.estabelecimento.length > LIMITE_NOME) p.push(`Estabelecimento com mais de ${LIMITE_NOME} caracteres.`);
  if (b.setor.length > LIMITE_NOME) p.push(`Setor com mais de ${LIMITE_NOME} caracteres.`);
  return p;
}

function melhorParecido(nome: string, opcoes: { id: string; nome: string }[]): string | null {
  let melhor: { id: string; s: number } | null = null;
  for (const o of opcoes) {
    const s = similaridade(nome, o.nome);
    if (s >= LIMITE_SUGESTAO && (!melhor || s > melhor.s)) melhor = { id: o.id, s };
  }
  return melhor?.id ?? null;
}

function acharContrato(b: LinhaBruta, ctx: ContextoImportacao, dec: Decisoes): { contrato: ContratoCtx | null; opcoes: ContratoCtx[]; problema?: string } {
  const escolhido = dec.contrato[b.linha];
  if (escolhido) {
    const c = ctx.contratos.find((x) => x.id === escolhido && x.ativo);
    return c ? { contrato: c, opcoes: [] } : { contrato: null, opcoes: ctx.contratos.filter((x) => x.ativo), problema: "O contrato escolhido não está mais disponível." };
  }
  if (!b.cliente || !b.sistema) {
    return { contrato: null, opcoes: ctx.contratos.filter((x) => x.ativo), problema: !b.cliente ? "Cliente em branco." : "Sistema em branco." };
  }
  const cliente = chaveNome(b.cliente);
  const sistema = chaveNome(b.sistema);
  const bate = ctx.contratos.filter((c) => chaveNome(c.clienteNome) === cliente && (chaveNome(c.sistemaNome) === sistema || chaveNome(c.sistemaCodigo) === sistema));
  const ativos = bate.filter((c) => c.ativo);
  if (ativos.length === 1) return { contrato: ativos[0], opcoes: [] };
  const todosAtivos = ctx.contratos.filter((c) => c.ativo);
  if (ativos.length > 1) return { contrato: null, opcoes: ativos, problema: `Há mais de um contrato de ${ativos[0].clienteNome} para ${ativos[0].sistemaNome}. Escolha qual.` };
  if (bate.length) return { contrato: null, opcoes: todosAtivos, problema: "O contrato desse cliente e sistema está inativo. Escolha outro contrato ou pule a linha." };
  const clienteExiste = ctx.contratos.some((c) => chaveNome(c.clienteNome) === cliente);
  return {
    contrato: null,
    opcoes: todosAtivos,
    problema: clienteExiste
      ? `O cliente “${b.cliente}” não tem contrato do sistema “${b.sistema}”. Escolha outro contrato ou pule a linha.`
      : `O cliente “${b.cliente}” não foi encontrado. Escolha um contrato ou pule a linha (clientes vêm do SINC e contratos se cadastram em Clientes).`,
  };
}

/**
 * Resolve todas as linhas com as decisões atuais: o que bateu, o que precisa de pergunta, o que tem erro, o que já
 * existe ou se repete. A ordem importa: a primeira ocorrência de um item vale, as repetidas viram "duplicada".
 */
export function resolverLinhas(linhas: LinhaBruta[], ctx: ContextoImportacao, dec: Decisoes): LinhaResolvida[] {
  const existentes = new Set(ctx.existentes.map((e) => `${e.contratoId}|${e.unidadeId}|${e.setorId ?? ""}|${e.tipo}`));
  const vistos = new Set<string>();
  const resolvidas: LinhaResolvida[] = [];

  for (const b of linhas) {
    const problemas: string[] = [];
    const problemaDoCampo: Partial<Record<CampoItem, string>> = {};
    const falha = (campo: CampoItem, mensagem: string) => {
      problemas.push(mensagem);
      problemaDoCampo[campo] = mensagem;
    };
    const perguntas: Pergunta[] = [];
    const { contrato, opcoes, problema } = acharContrato(b, ctx, dec);
    const pulada = !!dec.pular[b.linha];
    if (!contrato && problema) falha("contrato", problema);

    const atividade = dec.atividade[b.linha] ?? b.atividade;
    if (!atividade) falha("atividade", b.atividadeTexto ? `Atividade não reconhecida: “${b.atividadeTexto}”.` : "Atividade em branco.");
    const prazo = dec.prazo[b.linha] ?? b.prazo;
    if (!prazo || !prazoValido(prazo)) falha("prazo", b.prazoTexto ? `Prazo inválido: “${b.prazoTexto}”.` : "Prazo em branco.");
    const semConserto = problemasSemConserto(b);
    problemas.push(...semConserto);

    let unidade: RefUnidade | null = null;
    let setor: RefSetor | undefined = undefined;

    if (contrato && b.estabelecimento && b.estabelecimento.length <= LIMITE_NOME) {
      const unidades = ctx.unidades[contrato.clienteId] ?? [];
      const achada = unidades.find((u) => chaveNome(u.nome) === chaveNome(b.estabelecimento));
      const kEstab = chaveEstab(contrato.clienteId, b.estabelecimento);
      const d = dec.estab[kEstab];
      const escolhida = d?.acao === "usar" ? unidades.find((u) => u.id === d.id) : undefined;
      if (achada) unidade = { tipo: "existente", id: achada.id, nome: achada.nome };
      else {
        let decisao: Decisao | null = null;
        if (escolhida) {
          unidade = { tipo: "existente", id: escolhida.id, nome: escolhida.nome };
          decisao = d!;
        } else if (d?.acao === "cadastrar") {
          unidade = { tipo: "nova", nome: b.estabelecimento, chave: kEstab };
          decisao = d;
        }
        const existentesU = unidades.map((u) => ({ id: u.id, nome: u.nome }));
        perguntas.push({ campo: "estabelecimento", nome: b.estabelecimento, chave: kEstab, onde: contrato.clienteNome, existentes: existentesU, sugerido: melhorParecido(b.estabelecimento, existentesU), linhas: [b.linha], decisao });
      }

      if (unidade) {
        if (!b.setor) setor = null;
        else if (b.setor.length <= LIMITE_NOME) {
          if (unidade.tipo === "nova") setor = { tipo: "novo", nome: b.setor, chave: chaveSetor(`novo:${unidade.chave}`, b.setor) };
          else {
            const idUnidade = unidade.id;
            const setores = unidades.find((u) => u.id === idUnidade)?.setores ?? [];
            const achado = setores.find((s) => chaveNome(s.nome) === chaveNome(b.setor));
            const kSetor = chaveSetor(idUnidade, b.setor);
            const ds = dec.setor[kSetor];
            const escolhido = ds?.acao === "usar" ? setores.find((s) => s.id === ds.id) : undefined;
            if (achado) setor = { tipo: "existente", id: achado.id, nome: achado.nome };
            else {
              let decisao: Decisao | null = null;
              if (escolhido) {
                setor = { tipo: "existente", id: escolhido.id, nome: escolhido.nome };
                decisao = ds!;
              } else if (ds?.acao === "cadastrar") {
                setor = { tipo: "novo", nome: b.setor, chave: kSetor };
                decisao = ds;
              }
              const existentesS = setores.map((s) => ({ id: s.id, nome: s.nome }));
              perguntas.push({ campo: "setor", nome: b.setor, chave: kSetor, onde: unidade.nome, existentes: existentesS, sugerido: melhorParecido(b.setor, existentesS), linhas: [b.linha], decisao });
            }
          }
        }
      }
    }

    let situacao: SituacaoLinha;
    let motivoDuplicada: string | undefined;
    if (pulada) situacao = "pulada";
    else if (problemas.length) situacao = "erro";
    else if (perguntas.some((p) => !p.decisao)) situacao = "decidir";
    else {
      const refU = unidade!.tipo === "existente" ? unidade!.id : `novo:${unidade!.chave}`;
      const refS = setor === null || setor === undefined ? "" : setor.tipo === "existente" ? setor.id : `novo:${setor.chave}`;
      const chave = `${contrato!.id}|${refU}|${refS}|${atividade}`;
      if (unidade!.tipo === "existente" && (setor === null || setor!.tipo === "existente") && existentes.has(chave)) {
        situacao = "duplicada";
        motivoDuplicada = "Já existe no cronograma.";
      } else if (vistos.has(chave)) {
        situacao = "duplicada";
        motivoDuplicada = "Repetida na planilha: vale a primeira.";
      } else {
        situacao = "pronta";
        vistos.add(chave);
      }
    }

    resolvidas.push({ bruta: b, situacao, contrato, contratoOpcoes: opcoes, unidade, setor, atividade, prazo, observacao: b.observacao, problemas, problemaDoCampo, semConserto, perguntas, motivoDuplicada });
  }
  return resolvidas;
}

// ---------- Revisão em etapas: um item por vez ----------

/** Nada mais a perguntar sobre a linha: vai ser criada, não entra (já existe ou repete) ou foi pulada. */
export const linhaResolvida = (l: LinhaResolvida) => l.situacao === "pronta" || l.situacao === "duplicada" || l.situacao === "pulada";

/** As linhas que precisam do usuário (pergunta ou erro). As outras entram sozinhas e só aparecem no resumo final. */
export const linhasQueExigemVoce = (resolvidas: LinhaResolvida[]) => resolvidas.filter((l) => l.situacao === "decidir" || l.situacao === "erro");

function campoResolvido(l: LinhaResolvida, c: CampoItem): boolean {
  switch (c) {
    case "contrato":
      return l.contrato !== null;
    case "estabelecimento":
      return l.unidade !== null;
    case "setor":
      return l.setor !== undefined;
    case "atividade":
      return l.atividade !== null;
    case "prazo":
      return l.prazo !== null && prazoValido(l.prazo);
  }
}

export interface EtapasDaLinha {
  /** Campo em que o item parou: o primeiro, na ordem, que ainda não está resolvido. Nulo quando nada falta. */
  atual: CampoItem | null;
  /** Campos que a tela mostra: os já resolvidos e o atual. Os seguintes aparecem quando este for resolvido. */
  visiveis: CampoItem[];
  /** Problemas que a tela não corrige (só pulando a linha). */
  semConserto: string[];
}

export function etapasDaLinha(l: LinhaResolvida): EtapasDaLinha {
  const atual = ORDEM_CAMPOS.find((c) => !campoResolvido(l, c)) ?? null;
  const visiveis = atual ? ORDEM_CAMPOS.slice(0, ORDEM_CAMPOS.indexOf(atual) + 1) : [...ORDEM_CAMPOS];
  return { atual, visiveis, semConserto: l.semConserto };
}

/**
 * Para onde vai o "Próximo": o próximo item da fila que ainda não está resolvido (um item resolvido pela resposta
 * de outro não precisa de ninguém). Sem nenhum, é o resumo, que fica depois do último item (índice = tamanho da fila).
 */
export function proximoDaFila(fila: LinhaResolvida[], atual: number): number {
  for (let i = atual + 1; i < fila.length; i++) if (!linhaResolvida(fila[i])) return i;
  return fila.length;
}

/**
 * Todas as perguntas da planilha sem repetição, respondidas ou não: cada nome que não existe é perguntado uma vez,
 * com todas as linhas que o usam. As respondidas continuam na lista (com a resposta) para o usuário poder mudar.
 */
export function perguntasDaPlanilha(resolvidas: LinhaResolvida[]): Pergunta[] {
  const porChave = new Map<string, Pergunta>();
  for (const l of resolvidas) {
    if (l.situacao === "pulada") continue;
    for (const p of l.perguntas) {
      const atual = porChave.get(`${p.campo}|${p.chave}`);
      if (atual) atual.linhas.push(...p.linhas);
      else porChave.set(`${p.campo}|${p.chave}`, { ...p, linhas: [...p.linhas] });
    }
  }
  return [...porChave.values()];
}

export interface ResumoImportacao {
  total: number;
  prontas: number;
  decidir: number;
  erro: number;
  duplicadas: number;
  puladas: number;
  /** Estabelecimentos e setores que serão cadastrados, sem repetição. */
  estabelecimentosNovos: { nome: string; cliente: string }[];
  setoresNovos: { nome: string; estabelecimento: string }[];
}

export function resumir(resolvidas: LinhaResolvida[]): ResumoImportacao {
  const n = (s: SituacaoLinha) => resolvidas.filter((l) => l.situacao === s).length;
  const estab = new Map<string, { nome: string; cliente: string }>();
  const setores = new Map<string, { nome: string; estabelecimento: string }>();
  for (const l of resolvidas) {
    if (l.situacao !== "pronta") continue;
    if (l.unidade?.tipo === "nova" && !estab.has(l.unidade.chave)) estab.set(l.unidade.chave, { nome: l.unidade.nome, cliente: l.contrato!.clienteNome });
    if (l.setor?.tipo === "novo" && !setores.has(l.setor.chave)) setores.set(l.setor.chave, { nome: l.setor.nome, estabelecimento: l.unidade!.nome });
  }
  return { total: resolvidas.length, prontas: n("pronta"), decidir: n("decidir"), erro: n("erro"), duplicadas: n("duplicada"), puladas: n("pulada"), estabelecimentosNovos: [...estab.values()], setoresNovos: [...setores.values()] };
}

/** Pode confirmar: nenhuma linha (não pulada) ficou com pergunta ou erro, e há algo para criar. */
export const podeConfirmar = (r: ResumoImportacao) => r.decidir === 0 && r.erro === 0 && r.prontas > 0;

// ---------- Pedido enviado ao servidor ----------

export type PedidoUnidade = { tipo: "existente"; id: string } | { tipo: "nova"; nome: string };
export type PedidoSetor = null | { tipo: "existente"; id: string } | { tipo: "novo"; nome: string };

export interface PedidoLinha {
  linha: number;
  contratoId: string;
  unidade: PedidoUnidade;
  setor: PedidoSetor;
  atividade: TipoVisita;
  prazo: string;
  observacao: string;
}

/** O que o usuário aprovou: só as linhas prontas. O servidor confere tudo de novo. */
export function montarPedido(resolvidas: LinhaResolvida[]): PedidoLinha[] {
  const pedido: PedidoLinha[] = [];
  for (const l of resolvidas) {
    if (l.situacao !== "pronta") continue;
    const u = l.unidade!;
    const s = l.setor ?? null;
    pedido.push({
      linha: l.bruta.linha,
      contratoId: l.contrato!.id,
      unidade: u.tipo === "existente" ? { tipo: "existente", id: u.id } : { tipo: "nova", nome: u.nome },
      setor: s === null ? null : s.tipo === "existente" ? { tipo: "existente", id: s.id } : { tipo: "novo", nome: s.nome },
      atividade: l.atividade!,
      prazo: l.prazo!,
      observacao: l.observacao,
    });
  }
  return pedido;
}
