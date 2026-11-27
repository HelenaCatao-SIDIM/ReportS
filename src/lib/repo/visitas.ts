import "server-only";
import { Prisma } from "@/generated/reports/client";
import { idPlataforma, idTexto, plataforma, reports } from "@/lib/db";
import { formatarDataHora } from "@/lib/datas";
import { rotuloTipos } from "@/lib/visitas";
import type {
  AlteracaoVisita, ContribuicaoTecnico, EnderecoVisita, EstadoParticipante, EstadoTecnico, Foto, LocalVisita, MeioRegistro, MudancaCampo, PresencaVisita, StatusVisita, TipoVisita,
  UsuarioPublico, Visita, VisitaDetalhada,
} from "@/lib/types";
import { nomesDosClientes } from "./clientes";
import { nomesDasEquipes } from "./equipes";
import { buscarTemasPorIds } from "./temas";
import { nomesDosSistemas } from "./sistemas";
import { nomesDosUsuarios } from "./usuarios";

/*
 * Visitas — banco do ReportS. Técnico, cliente e participantes são ids da plataforma; os nomes vêm de lá na leitura.
 * Locais (coordenada, precisão, horários e CEP), fotos e prints ficam em JSON, na mesma forma do protótipo.
 * Só pode haver uma visita em andamento por técnico: o índice único parcial do banco garante.
 */

export type { VisitaDetalhada };

const INCLUIR = {
  temas: { select: { temaId: true } },
  equipes: { select: { equipeId: true } },
  presencas: { orderBy: { ordem: "asc" } },
  alteracoes: { orderBy: { em: "asc" } },
  tecnicos: { orderBy: { convidadoEm: "asc" } },
  estabelecimento: { select: { nome: true } },
  contrato: { select: { sistemaDoClienteId: true } },
  relatorio: { select: { status: true } },
} as const;

type Linha = Prisma.VisitaGetPayload<{ include: typeof INCLUIR }>;

/** Json? do Prisma: null precisa ser DbNull. */
const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

const paraPresenca = (p: Linha["presencas"][number]): PresencaVisita => ({
  participanteId: idTexto(p.participanteId),
  estado: p.estado as EstadoParticipante,
  nome: p.nome,
  cbo: p.cboCodigo ? { codigo: p.cboCodigo, titulo: p.cboTitulo ?? "" } : null,
  cpf: p.cpf,
  confirmacao: p.confirmacao as PresencaVisita["confirmacao"],
  validacao: (p.validacao as PresencaVisita["validacao"]) ?? null,
  assinatura: p.assinatura,
});

const paraAlteracao = (a: Linha["alteracoes"][number]): AlteracaoVisita => ({
  id: a.id,
  autorId: idTexto(a.autorId),
  autorNome: a.autorNome,
  em: a.em.toISOString(),
  acao: a.acao as AlteracaoVisita["acao"],
  motivo: a.motivo,
  mudancas: a.mudancas as unknown as MudancaCampo[],
});

const paraVisita = (v: Linha): Visita => ({
  id: v.id,
  tecnicoId: idTexto(v.tecnicoId),
  clienteId: idTexto(v.clienteId),
  contratoId: v.contratoId,
  unidadeId: v.estabelecimentoId,
  tipo: v.tipo as TipoVisita,
  // Visitas antigas (antes do multi-tipo) podem ter `tipos` vazio: cai no tipo principal.
  tipos: (v.tipos.length ? v.tipos : [v.tipo]) as TipoVisita[],
  status: v.status as StatusVisita,
  entrada: v.entrada.toISOString(),
  saida: v.saida?.toISOString() ?? null,
  checkin: v.checkin as unknown as LocalVisita | null,
  checkout: v.checkout as unknown as LocalVisita | null,
  meio: v.meio as MeioRegistro,
  distanciaCheckinM: v.distanciaCheckinM,
  raioCheckinM: v.raioCheckinM,
  fotoAmbiente: v.fotoAmbiente as unknown as Foto | null,
  printTela: v.printTela as unknown as Foto | null,
  linkReuniao: v.linkReuniao,
  equipeIds: v.equipes.map((e) => e.equipeId),
  temaIds: v.temas.map((t) => t.temaId),
  temaAdicional: v.temaAdicional,
  fotosExtras: (v.fotosExtras as unknown as Foto[]) ?? [],
  presencas: v.presencas.map(paraPresenca),
  observacoes: v.observacoes,
  pendencias: v.pendencias,
  proximosPassos: v.proximosPassos,
  encerradaPelaAdministracao: v.encerradaPelaAdministracao,
  relatorioId: v.relatorioId,
  historico: v.alteracoes.map(paraAlteracao),
});

/** Contribuição do técnico principal, a partir das colunas da própria visita. */
const contribuicaoPrincipal = (v: Visita, nome: string): ContribuicaoTecnico => ({
  tecnicoId: v.tecnicoId,
  nome,
  papel: "principal",
  // Já fez o próprio check-out quando tem saída (mesmo que a visita siga aberta esperando um convidado).
  estado: v.status === "em_andamento" ? (v.saida ? "encerrado" : "ativo") : "encerrado",
  entrada: v.entrada,
  saida: v.saida,
  checkin: v.checkin,
  checkout: v.checkout,
  meio: v.meio,
  fotoAmbiente: v.fotoAmbiente,
  printTela: v.printTela,
  // As fotos da lista de presença são compartilhadas (aparecem à parte); as extras do principal ficam com ele.
  fotosExtras: v.fotosExtras.filter((f) => f.legenda !== "lista_presenca"),
  distanciaCheckinM: v.distanciaCheckinM,
  raioCheckinM: v.raioCheckinM,
  observacoes: v.observacoes,
  pendencias: v.pendencias,
  proximosPassos: v.proximosPassos,
});

/** Contribuição de um técnico convidado, a partir da linha de `visita_tecnicos`. */
const contribuicaoConvidado = (t: Linha["tecnicos"][number], nome: string): ContribuicaoTecnico => ({
  tecnicoId: idTexto(t.tecnicoId),
  nome,
  papel: "convidado",
  estado: t.estado as EstadoTecnico,
  entrada: t.entrada?.toISOString() ?? null,
  saida: t.saida?.toISOString() ?? null,
  checkin: t.checkin as unknown as LocalVisita | null,
  checkout: t.checkout as unknown as LocalVisita | null,
  meio: (t.meio || null) as MeioRegistro | null,
  fotoAmbiente: t.fotoAmbiente as unknown as Foto | null,
  printTela: t.printTela as unknown as Foto | null,
  fotosExtras: (t.fotosExtras as unknown as Foto[]) ?? [],
  distanciaCheckinM: t.distanciaCheckinM,
  raioCheckinM: t.raioCheckinM,
  observacoes: t.observacoes,
  pendencias: t.pendencias,
  proximosPassos: t.proximosPassos,
});

/** Resolve os nomes de várias visitas com uma consulta por cadastro. */
async function detalharTodas(linhas: Linha[]): Promise<VisitaDetalhada[]> {
  if (!linhas.length) return [];
  const [tecnicos, clientes, sistemas, nomeDoSistema, temas, equipes] = await Promise.all([
    nomesDosUsuarios(linhas.flatMap((v) => [idTexto(v.tecnicoId), ...v.tecnicos.map((t) => idTexto(t.tecnicoId))])),
    nomesDosClientes(linhas.map((v) => idTexto(v.clienteId))),
    plataforma.clients.findMany({ where: { id: { in: [...new Set(linhas.map((v) => v.contrato.sistemaDoClienteId))] } }, select: { id: true, sistema: true } }),
    nomesDosSistemas(),
    buscarTemasPorIds([...new Set(linhas.flatMap((v) => v.temas.map((t) => t.temaId)))]),
    nomesDasEquipes([...new Set(linhas.flatMap((v) => v.equipes.map((e) => e.equipeId)))]),
  ]);
  const sistemaDe = new Map(sistemas.map((s) => [s.id, s.sistema]));
  return linhas.map((linha) => {
    const v = paraVisita(linha);
    const sistema = sistemaDe.get(linha.contrato.sistemaDoClienteId) ?? "";
    const principalNome = tecnicos.get(v.tecnicoId) ?? "—";
    return {
      ...v,
      tecnicoNome: principalNome,
      clienteNome: clientes.get(v.clienteId) ?? "—",
      sistema,
      sistemaNome: sistema ? nomeDoSistema(sistema) : "—",
      unidadeNome: linha.estabelecimento.nome,
      equipes: v.equipeIds.map((id) => equipes.get(id) ?? "—").sort((a, b) => a.localeCompare(b, "pt-BR")),
      temas: temas.filter((t) => v.temaIds.includes(t.id)),
      travada: linha.relatorio?.status === "aprovado",
      conjunta: linha.tecnicos.length > 0,
      tecnicos: [
        contribuicaoPrincipal(v, principalNome),
        ...linha.tecnicos.map((t) => contribuicaoConvidado(t, tecnicos.get(idTexto(t.tecnicoId)) ?? "—")),
      ],
    };
  });
}

async function detalhar(linha: Linha | null): Promise<VisitaDetalhada | null> {
  return linha ? (await detalharTodas([linha]))[0] : null;
}

// ---------- Consultas ----------

/** Em andamento, da mais antiga para a mais recente (as esquecidas aparecem primeiro). */
export async function listarEmAndamento(): Promise<VisitaDetalhada[]> {
  return detalharTodas(await reports.visita.findMany({ where: { status: "em_andamento" }, include: INCLUIR, orderBy: { entrada: "asc" } }));
}

export interface FiltroVisitas {
  clienteId?: string;
  tecnicoId?: string;
  /** ISO inclusive. */
  de?: string;
  ate?: string;
  incluirCanceladas?: boolean;
}

const periodo = (de?: string, ate?: string) => (de || ate ? { entrada: { ...(de ? { gte: new Date(de) } : {}), ...(ate ? { lte: new Date(ate) } : {}) } } : {});

/** Filtro por id da plataforma: id que não é número não acha nada. */
const porIdPlataforma = (id: string) => idPlataforma(id) ?? BigInt(-1);

/** Encerradas (e, opcionalmente, canceladas), da mais recente para a mais antiga. */
export async function listarEncerradas(f: FiltroVisitas = {}): Promise<VisitaDetalhada[]> {
  return detalharTodas(
    await reports.visita.findMany({
      where: {
        status: { in: f.incluirCanceladas ? ["encerrada", "cancelada"] : ["encerrada"] },
        ...(f.clienteId ? { clienteId: porIdPlataforma(f.clienteId) } : {}),
        ...(f.tecnicoId ? { tecnicoId: porIdPlataforma(f.tecnicoId) } : {}),
        ...periodo(f.de, f.ate),
      },
      include: INCLUIR,
      orderBy: { entrada: "desc" },
    }),
  );
}

export async function buscarVisita(id: string): Promise<VisitaDetalhada | null> {
  return detalhar(await reports.visita.findUnique({ where: { id }, include: INCLUIR }));
}

// ---------- Alterações pela administração ----------

function registro(visitaId: string, autor: UsuarioPublico, acao: AlteracaoVisita["acao"], motivo: string, mudancas: MudancaCampo[]) {
  return {
    id: crypto.randomUUID(),
    visitaId,
    autorId: idPlataforma(autor.id)!,
    autorNome: autor.nome,
    em: new Date(),
    acao,
    motivo,
    mudancas: mudancas as unknown as Prisma.InputJsonValue,
  };
}

/** Muda a situação só se a visita ainda está em andamento (duas pessoas na mesma tela: vale a primeira). */
async function sairDeEmAndamento(
  id: string,
  dados: Prisma.VisitaUpdateManyMutationInput,
  alteracao: ReturnType<typeof registro>,
) {
  await reports.$transaction(async (tx) => {
    const { count } = await tx.visita.updateMany({ where: { id, status: "em_andamento" }, data: dados });
    if (!count) throw new Error("Visita não está em andamento");
    await tx.alteracaoVisita.create({ data: alteracao });
    // Encerrou ou cancelou a visita pela Administração: fecha os vínculos de convidado ainda abertos, para liberar os técnicos.
    await tx.visitaTecnico.updateMany({ where: { visitaId: id, saida: null }, data: { saida: new Date(), estado: "encerrado" } });
  });
}

/** Encerra uma visita esquecida aberta, com o horário de saída informado pela administração. */
export async function encerrarPelaAdministracao(id: string, saida: string, autor: UsuarioPublico, justificativa: string) {
  await sairDeEmAndamento(
    id,
    { status: "encerrada", saida: new Date(saida), encerradaPelaAdministracao: true },
    registro(id, autor, "encerramento", justificativa, [{ campo: "Saída", antes: "—", depois: formatarDataHora(saida) }]),
  );
}

/** Cancela um check-in feito por engano. A visita não entra em relatório. */
export async function cancelarPelaAdministracao(id: string, autor: UsuarioPublico, justificativa: string) {
  await sairDeEmAndamento(
    id,
    { status: "cancelada" },
    registro(id, autor, "cancelamento", justificativa, [{ campo: "Situação", antes: "Em andamento", depois: "Cancelada" }]),
  );
}

export interface CorrecaoVisita {
  entrada: string;
  saida: string;
  tipos: TipoVisita[];
  unidadeId: string;
  /** Equipes treinadas; vazio quando o tipo não registra equipes. */
  equipeIds: string[];
  temaIds: string[];
  temaAdicional: string;
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
  /** Participantes a retirar da lista de presença. */
  removerPresencas: string[];
  /** Fotos extras a retirar. */
  removerFotos: string[];
}

/** Aplica a correção e registra o histórico. Retorna as mudanças (vazio = nada mudou, nada é gravado). */
export async function corrigirPelaAdministracao(id: string, c: CorrecaoVisita, autor: UsuarioPublico, motivo: string): Promise<MudancaCampo[]> {
  const v = await buscarVisita(id);
  if (!v || v.status !== "encerrada") throw new Error("Só visitas encerradas podem ser corrigidas");
  if (v.travada) throw new Error("Visita em relatório aprovado");

  const [temas, equipes, unidades] = await Promise.all([
    buscarTemasPorIds([...new Set([...v.temaIds, ...c.temaIds])]),
    nomesDasEquipes([...new Set([...v.equipeIds, ...c.equipeIds])]),
    reports.estabelecimento.findMany({ where: { id: { in: [v.unidadeId, c.unidadeId] } }, select: { id: true, nome: true } }),
  ]);
  const nomeTemas = (ids: string[]) => temas.filter((t) => ids.includes(t.id)).map((t) => t.nome).join(", ") || "—";
  const nomeEquipes = (ids: string[]) =>
    [...new Set(ids)].map((id) => equipes.get(id) ?? "—").sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ") || "—";
  const nomeUnidade = (uid: string) => unidades.find((u) => u.id === uid)?.nome ?? "—";

  const mudancas: MudancaCampo[] = [];
  const comparar = (campo: string, antes: string, depois: string) => {
    if (antes !== depois) mudancas.push({ campo, antes: antes || "—", depois: depois || "—" });
  };

  comparar("Entrada", formatarDataHora(v.entrada), formatarDataHora(c.entrada));
  comparar("Saída", v.saida ? formatarDataHora(v.saida) : "", formatarDataHora(c.saida));
  comparar("Tipos", rotuloTipos(v.tipos), rotuloTipos(c.tipos));
  comparar("Estabelecimento", nomeUnidade(v.unidadeId), nomeUnidade(c.unidadeId));
  comparar("Equipes treinadas", nomeEquipes(v.equipeIds), nomeEquipes(c.equipeIds));
  comparar("Temas", nomeTemas(v.temaIds), nomeTemas(c.temaIds));
  comparar("Tema adicional", v.temaAdicional, c.temaAdicional);
  comparar("Observações", v.observacoes, c.observacoes);
  comparar("Pendências", v.pendencias, c.pendencias);
  comparar("Próximos passos", v.proximosPassos, c.proximosPassos);

  const presencasRemovidas = v.presencas.filter((p) => c.removerPresencas.includes(p.participanteId));
  if (presencasRemovidas.length) {
    mudancas.push({ campo: "Participantes removidos", antes: presencasRemovidas.map((p) => p.nome).join(", "), depois: "—" });
  }
  const fotosRemovidas = v.fotosExtras.filter((f) => c.removerFotos.includes(f.id));
  if (fotosRemovidas.length) {
    mudancas.push({ campo: "Fotos extras", antes: `${v.fotosExtras.length} foto(s)`, depois: `${v.fotosExtras.length - fotosRemovidas.length} foto(s)` });
  }

  if (!mudancas.length) return [];

  const temaIds = [...new Set(c.temaIds)];
  const equipeIds = [...new Set(c.equipeIds)];
  await reports.$transaction(async (tx) => {
    // Só grava se a visita continua encerrada e fora de relatório aprovado.
    const { count } = await tx.visita.updateMany({
      where: { id, status: "encerrada", OR: [{ relatorioId: null }, { relatorio: { status: { not: "aprovado" } } }] },
      data: {
        entrada: new Date(c.entrada),
        saida: new Date(c.saida),
        tipo: c.tipos[0],
        tipos: c.tipos,
        estabelecimentoId: c.unidadeId,
        temaAdicional: c.temaAdicional,
        observacoes: c.observacoes,
        pendencias: c.pendencias,
        proximosPassos: c.proximosPassos,
        fotosExtras: v.fotosExtras.filter((f) => !c.removerFotos.includes(f.id)) as unknown as Prisma.InputJsonValue,
      },
    });
    if (!count) throw new Error("A visita mudou enquanto era corrigida. Abra de novo e confira.");
    await tx.visitaTema.deleteMany({ where: { visitaId: id } });
    await tx.visitaTema.createMany({ data: temaIds.map((temaId) => ({ visitaId: id, temaId })) });
    await tx.visitaEquipe.deleteMany({ where: { visitaId: id } });
    await tx.visitaEquipe.createMany({ data: equipeIds.map((equipeId) => ({ visitaId: id, equipeId })) });
    if (presencasRemovidas.length) {
      await tx.presenca.deleteMany({ where: { visitaId: id, participanteId: { in: presencasRemovidas.map((p) => idPlataforma(p.participanteId)!) } } });
    }
    await tx.alteracaoVisita.create({ data: registro(id, autor, "correcao", motivo, mudancas) });
  });
  return mudancas;
}

// ---------- App do Técnico ----------

/**
 * A visita em andamento do técnico, se houver. Vale como **principal** que ainda não saiu, ou como **convidado ativo**
 * (já fez o próprio check-in). Convite pendente (ainda sem check-in) não entra aqui — ver `convitesPendentes`.
 */
export async function visitaAbertaDoTecnico(tecnicoId: string): Promise<VisitaDetalhada | null> {
  const chave = porIdPlataforma(tecnicoId);
  return detalhar(
    await reports.visita.findFirst({
      where: {
        status: "em_andamento",
        OR: [{ tecnicoId: chave, saida: null }, { tecnicos: { some: { tecnicoId: chave, estado: "ativo" } } }],
      },
      include: INCLUIR,
    }),
  );
}

/** Visitas em andamento para as quais o técnico foi convidado e ainda não fez o próprio check-in. */
export async function convitesPendentes(tecnicoId: string): Promise<VisitaDetalhada[]> {
  const chave = porIdPlataforma(tecnicoId);
  return detalharTodas(
    await reports.visita.findMany({
      where: { status: "em_andamento", tecnicos: { some: { tecnicoId: chave, estado: "convidado" } } },
      include: INCLUIR,
      orderBy: { entrada: "desc" },
    }),
  );
}

/** Dos técnicos informados, os que já estão ocupados (visita aberta como principal ou vínculo aberto como convidado). */
export async function tecnicosOcupados(tecnicoIds: string[]): Promise<Set<string>> {
  const chaves = tecnicoIds.map((id) => idPlataforma(id)).filter((x): x is bigint => x !== null);
  if (!chaves.length) return new Set();
  const [principais, vinculados] = await Promise.all([
    reports.visita.findMany({ where: { tecnicoId: { in: chaves }, status: "em_andamento" }, select: { tecnicoId: true } }),
    reports.visitaTecnico.findMany({ where: { tecnicoId: { in: chaves }, saida: null }, select: { tecnicoId: true } }),
  ]);
  return new Set([...principais, ...vinculados].map((r) => idTexto(r.tecnicoId)));
}

export type DadosCheckin = Pick<
  Visita,
  | "tecnicoId" | "clienteId" | "contratoId" | "unidadeId" | "tipo" | "tipos" | "checkin" | "meio" | "distanciaCheckinM" | "raioCheckinM"
  | "fotoAmbiente" | "printTela" | "linkReuniao" | "equipeIds"
>;

const JA_TEM_ABERTA = "Técnico já tem uma visita em andamento";

/** O técnico já tem visita (não cancelada) que cruza o horário [entrada, saida]? A em andamento vale até agora. */
export async function tecnicoOcupadoNoHorario(tecnicoId: string, entrada: string, saida: string): Promise<boolean> {
  const chave = idPlataforma(tecnicoId);
  if (chave === null) return false;
  const candidatas = await reports.visita.findMany({
    where: { tecnicoId: chave, status: { not: "cancelada" }, entrada: { lt: new Date(saida) } },
    select: { saida: true },
  });
  return candidatas.some((v) => (v.saida ?? new Date()).getTime() > new Date(entrada).getTime());
}

export interface DadosRetroativa {
  tecnicoId: string;
  clienteId: string;
  contratoId: string;
  unidadeId: string;
  tipo: TipoVisita;
  tipos: TipoVisita[];
  entrada: string;
  saida: string;
  linkReuniao: string | null;
  equipeIds: string[];
  temaIds: string[];
  temaAdicional: string;
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
  fotos: Foto[];
  /** Participantes do cadastro, já conferidos por quem chama; entram sem assinatura (confirmação nominal). */
  presencas: PresencaVisita[];
}

/**
 * Lança pela Administração uma visita que já aconteceu: já encerrada, com os horários informados, sem GPS, sem foto do
 * check-in e sem assinatura. Fica marcada como "retroativa" (meio) e com o lançamento e o motivo no histórico.
 */
export async function lancarVisitaRetroativa(d: DadosRetroativa, autor: UsuarioPublico, motivo: string): Promise<string> {
  const tecnicoId = idPlataforma(d.tecnicoId);
  const clienteId = idPlataforma(d.clienteId);
  if (tecnicoId === null || clienteId === null) throw new Error("Técnico ou cliente inválido");
  const id = crypto.randomUUID();
  await reports.$transaction(async (tx) => {
    await tx.visita.create({
      data: {
        id,
        tecnicoId,
        clienteId,
        contratoId: d.contratoId,
        estabelecimentoId: d.unidadeId,
        tipo: d.tipo,
        tipos: d.tipos,
        status: "encerrada",
        entrada: new Date(d.entrada),
        saida: new Date(d.saida),
        checkin: Prisma.DbNull,
        checkout: Prisma.DbNull,
        meio: "retroativa",
        fotoAmbiente: Prisma.DbNull,
        printTela: Prisma.DbNull,
        linkReuniao: d.linkReuniao,
        temaAdicional: d.temaAdicional,
        fotosExtras: d.fotos as unknown as Prisma.InputJsonValue,
        observacoes: d.observacoes,
        pendencias: d.pendencias,
        proximosPassos: d.proximosPassos,
        temas: { create: [...new Set(d.temaIds)].map((temaId) => ({ temaId })) },
        equipes: { create: [...new Set(d.equipeIds)].map((equipeId) => ({ equipeId })) },
        presencas: {
          create: d.presencas.map((p, ordem) => ({
            id: crypto.randomUUID(),
            participanteId: idPlataforma(p.participanteId)!,
            estado: p.estado,
            nome: p.nome,
            cboCodigo: p.cbo?.codigo ?? null,
            cboTitulo: p.cbo?.titulo ?? null,
            cpf: p.cpf,
            confirmacao: "nominal",
            assinatura: null,
            validacao: null,
            ordem,
          })),
        },
      },
    });
    await tx.alteracaoVisita.create({
      data: registro(id, autor, "lancamento", motivo, [
        { campo: "Lançamento", antes: "—", depois: `Visita de ${formatarDataHora(d.entrada)} lançada pela Administração` },
      ]),
    });
  });
  return id;
}

const CONVIDADO_OCUPADO = "Um dos técnicos convidados já está em outra visita";

/**
 * Abre a visita com a hora do servidor. Recusa se o técnico já tem uma visita aberta (como principal ou convidado).
 * `convidadoIds`: visita conjunta — cada convidado entra como convite pendente e faz o próprio check-in depois.
 */
export async function abrirVisita(d: DadosCheckin, convidadoIds: string[] = []): Promise<Visita> {
  const tecnicoId = idPlataforma(d.tecnicoId);
  const clienteId = idPlataforma(d.clienteId);
  if (tecnicoId === null || clienteId === null) throw new Error("Técnico ou cliente inválido");
  // Não pode já ser principal de outra aberta nem estar vinculado a uma (convite ou convidado ativo).
  if (await reports.visita.count({ where: { tecnicoId, status: "em_andamento" } })) throw new Error(JA_TEM_ABERTA);
  if (await reports.visitaTecnico.count({ where: { tecnicoId, saida: null } })) throw new Error(JA_TEM_ABERTA);

  const convidados = [...new Set(convidadoIds)]
    .map((id) => idPlataforma(id))
    .filter((x): x is bigint => x !== null && x !== tecnicoId);

  const id = crypto.randomUUID();
  try {
    await reports.$transaction(async (tx) => {
      if (convidados.length) {
        const ocupados =
          (await tx.visita.count({ where: { tecnicoId: { in: convidados }, status: "em_andamento" } })) +
          (await tx.visitaTecnico.count({ where: { tecnicoId: { in: convidados }, saida: null } }));
        if (ocupados) throw new Error(CONVIDADO_OCUPADO);
      }
      await tx.visita.create({
        data: {
          id,
          tecnicoId,
          clienteId,
          contratoId: d.contratoId,
          estabelecimentoId: d.unidadeId,
          tipo: d.tipo,
          tipos: d.tipos,
          status: "em_andamento",
          entrada: new Date(),
          checkin: json(d.checkin),
          meio: d.meio,
          distanciaCheckinM: d.distanciaCheckinM,
          raioCheckinM: d.raioCheckinM,
          fotoAmbiente: json(d.fotoAmbiente),
          printTela: json(d.printTela),
          linkReuniao: d.linkReuniao,
          equipes: { create: [...new Set(d.equipeIds)].map((equipeId) => ({ equipeId })) },
          tecnicos: {
            create: convidados.map((cid) => ({ tecnicoId: cid, papel: "convidado", estado: "convidado", convidadoEm: new Date() })),
          },
        },
      });
    });
    return paraVisita(await reports.visita.findUniqueOrThrow({ where: { id }, include: INCLUIR }));
  } catch (e) {
    // Dois check-ins/convites ao mesmo tempo: os índices únicos parciais recusam o segundo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error(CONVIDADO_OCUPADO);
    throw e;
  }
}

export interface DadosEntradaConvidado {
  checkin: LocalVisita | null;
  meio: MeioRegistro;
  distanciaCheckinM: number | null;
  raioCheckinM: number | null;
  fotoAmbiente: Foto | null;
  printTela: Foto | null;
}

/** Check-in do técnico convidado: passa de convite pendente a ativo, com os próprios local, foto e aparelho. */
export async function entrarComoConvidado(visitaId: string, tecnicoId: string, d: DadosEntradaConvidado): Promise<void> {
  const chave = idPlataforma(tecnicoId);
  if (chave === null) throw new Error("Técnico inválido");
  const visita = await reports.visita.findUnique({ where: { id: visitaId }, select: { status: true } });
  if (!visita || visita.status !== "em_andamento") throw new Error("A visita já foi encerrada");
  const { count } = await reports.visitaTecnico.updateMany({
    where: { visitaId, tecnicoId: chave, estado: "convidado" },
    data: {
      estado: "ativo",
      entrada: new Date(),
      checkin: json(d.checkin),
      meio: d.meio,
      distanciaCheckinM: d.distanciaCheckinM,
      raioCheckinM: d.raioCheckinM,
      fotoAmbiente: json(d.fotoAmbiente),
      printTela: json(d.printTela),
    },
  });
  if (!count) throw new Error("Convite não encontrado ou já usado");
}

/**
 * Visita em andamento em que o técnico é **membro ativo** (principal que ainda não saiu ou convidado que fez check-in).
 * Devolve o papel, para as ações por técnico (anotações, check-out) saberem onde gravar. As edições compartilhadas
 * (temas, equipes, fotos, presenças) valem para qualquer membro ativo.
 */
async function membroAtivoDe(id: string, tecnicoId: string): Promise<{ papel: "principal" | "convidado" }> {
  const chave = idPlataforma(tecnicoId) ?? BigInt(-1);
  const v = await reports.visita.findUnique({
    where: { id },
    select: { tecnicoId: true, status: true, saida: true, tecnicos: { where: { tecnicoId: chave }, select: { estado: true } } },
  });
  if (!v) throw new Error("Visita não encontrada");
  if (v.status !== "em_andamento") throw new Error("A visita já foi encerrada");
  if (v.tecnicoId === chave) {
    if (v.saida !== null) throw new Error("Você já fez o check-out desta visita");
    return { papel: "principal" };
  }
  if (v.tecnicos[0]?.estado === "ativo") return { papel: "convidado" };
  throw new Error("Você não está nesta visita");
}

export async function definirTemas(id: string, tecnicoId: string, temaIds: string[]) {
  await membroAtivoDe(id, tecnicoId);
  await reports.$transaction([
    reports.visitaTema.deleteMany({ where: { visitaId: id } }),
    reports.visitaTema.createMany({ data: [...new Set(temaIds)].map((temaId) => ({ visitaId: id, temaId })) }),
  ]);
}

export async function definirEquipes(id: string, tecnicoId: string, equipeIds: string[]) {
  await membroAtivoDe(id, tecnicoId);
  await reports.$transaction([
    reports.visitaEquipe.deleteMany({ where: { visitaId: id } }),
    reports.visitaEquipe.createMany({ data: [...new Set(equipeIds)].map((equipeId) => ({ visitaId: id, equipeId })) }),
  ]);
}

export async function definirTemaAdicional(id: string, tecnicoId: string, texto: string) {
  await membroAtivoDe(id, tecnicoId);
  await reports.visita.update({ where: { id }, data: { temaAdicional: texto } });
}

/** Anotações da visita, guardadas enquanto o técnico escreve; o check-out parte delas. Cada técnico escreve as suas. */
export async function definirAnotacoes(id: string, tecnicoId: string, a: { observacoes: string; pendencias: string; proximosPassos: string }) {
  const { papel } = await membroAtivoDe(id, tecnicoId);
  if (papel === "principal") {
    await reports.visita.update({ where: { id }, data: { observacoes: a.observacoes, pendencias: a.pendencias, proximosPassos: a.proximosPassos } });
  } else {
    await reports.visitaTecnico.update({
      where: { visitaId_tecnicoId: { visitaId: id, tecnicoId: idPlataforma(tecnicoId)! } },
      data: { observacoes: a.observacoes, pendencias: a.pendencias, proximosPassos: a.proximosPassos },
    });
  }
}

/** Fotos extras são por técnico: o principal grava na visita; o convidado, na própria linha. Append no banco para dois envios não se sobrescreverem. */
export async function adicionarFotoExtra(id: string, tecnicoId: string, foto: Foto) {
  const { papel } = await membroAtivoDe(id, tecnicoId);
  const valor = JSON.stringify([foto]);
  if (papel === "principal") {
    await reports.$executeRaw`UPDATE visitas SET fotos_extras = fotos_extras || ${valor}::jsonb WHERE id = ${id}`;
  } else {
    await reports.$executeRaw`UPDATE visita_tecnicos SET fotos_extras = fotos_extras || ${valor}::jsonb WHERE visita_id = ${id} AND tecnico_id = ${idPlataforma(tecnicoId)!}`;
  }
}

export async function removerFotoExtra(id: string, tecnicoId: string, fotoId: string) {
  const { papel } = await membroAtivoDe(id, tecnicoId);
  if (papel === "principal") {
    await reports.$executeRaw`
      UPDATE visitas
      SET fotos_extras = COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements(fotos_extras) f WHERE f->>'id' <> ${fotoId}), '[]'::jsonb)
      WHERE id = ${id}`;
  } else {
    await reports.$executeRaw`
      UPDATE visita_tecnicos
      SET fotos_extras = COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements(fotos_extras) f WHERE f->>'id' <> ${fotoId}), '[]'::jsonb)
      WHERE visita_id = ${id} AND tecnico_id = ${idPlataforma(tecnicoId)!}`;
  }
}

export async function adicionarPresenca(id: string, tecnicoId: string, p: PresencaVisita) {
  await membroAtivoDe(id, tecnicoId);
  const participanteId = idPlataforma(p.participanteId);
  if (participanteId === null) throw new Error("Participante inválido");
  const ultima = await reports.presenca.aggregate({ where: { visitaId: id }, _max: { ordem: true } });
  try {
    await reports.presenca.create({
      data: {
        id: crypto.randomUUID(),
        visitaId: id,
        participanteId,
        estado: p.estado,
        nome: p.nome,
        cboCodigo: p.cbo?.codigo ?? null,
        cboTitulo: p.cbo?.titulo ?? null,
        cpf: p.cpf,
        confirmacao: p.confirmacao,
        validacao: p.validacao ?? null,
        assinatura: p.assinatura,
        ordem: (ultima._max.ordem ?? -1) + 1,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error("Participante já está na lista");
    throw e;
  }
}

export async function removerPresenca(id: string, tecnicoId: string, participanteId: string) {
  await membroAtivoDe(id, tecnicoId);
  const chave = idPlataforma(participanteId);
  if (chave !== null) await reports.presenca.deleteMany({ where: { visitaId: id, participanteId: chave } });
}

export type ResultadoExclusao = "ok" | "nao_encontrada" | "nao_encerrada" | "em_relatorio";

/**
 * Exclui de vez uma visita encerrada que não está em nenhum relatório (`relatorioId` nulo cobre rascunho, versões emitidas e
 * aprovadas). Apaga os filhos — presenças, temas, equipes e histórico — na mesma transação. As fotos no disco ficam
 * (podem ser de uma versão de relatório já emitida; é o mesmo que a correção faz). Não dá para desfazer.
 */
export async function excluirVisita(id: string): Promise<ResultadoExclusao> {
  const v = await reports.visita.findUnique({ where: { id }, select: { status: true, relatorioId: true } });
  if (!v) return "nao_encontrada";
  if (v.status !== "encerrada") return "nao_encerrada";
  if (v.relatorioId) return "em_relatorio";
  return reports.$transaction(async (tx) => {
    // Confere de novo dentro da transação (outro processo pode ter vinculado a visita a um relatório nesse meio-tempo).
    const atual = await tx.visita.findUnique({ where: { id }, select: { status: true, relatorioId: true } });
    if (!atual) return "nao_encontrada";
    if (atual.status !== "encerrada") return "nao_encerrada";
    if (atual.relatorioId) return "em_relatorio";
    await tx.presenca.deleteMany({ where: { visitaId: id } });
    await tx.visitaTema.deleteMany({ where: { visitaId: id } });
    await tx.visitaEquipe.deleteMany({ where: { visitaId: id } });
    await tx.alteracaoVisita.deleteMany({ where: { visitaId: id } });
    await tx.visita.delete({ where: { id } });
    return "ok";
  });
}

export interface DadosCheckout {
  checkout: Visita["checkout"];
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
}

/** Check-out pelo técnico: saída com a hora do servidor; depois disso a visita não é mais editável por ele. */
/**
 * Check-out de um técnico. Cada um faz o seu: grava o próprio local e textos. A visita só é **encerrada** quando o
 * principal já saiu e nenhum convidado ativo resta (convites sem check-in são cancelados no fecho e não travam).
 */
export async function encerrarPeloTecnico(id: string, tecnicoId: string, d: DadosCheckout): Promise<Visita> {
  const { papel } = await membroAtivoDe(id, tecnicoId);
  const chave = idPlataforma(tecnicoId)!;
  await reports.$transaction(async (tx) => {
    if (papel === "principal") {
      const { count } = await tx.visita.updateMany({
        where: { id, status: "em_andamento", saida: null },
        data: { checkout: json(d.checkout), observacoes: d.observacoes, pendencias: d.pendencias, proximosPassos: d.proximosPassos, saida: new Date() },
      });
      if (!count) throw new Error("A visita já foi encerrada");
    } else {
      const { count } = await tx.visitaTecnico.updateMany({
        where: { visitaId: id, tecnicoId: chave, estado: "ativo" },
        data: { checkout: json(d.checkout), observacoes: d.observacoes, pendencias: d.pendencias, proximosPassos: d.proximosPassos, saida: new Date(), estado: "encerrado" },
      });
      if (!count) throw new Error("A visita já foi encerrada");
    }
    const atual = await tx.visita.findUniqueOrThrow({ where: { id }, select: { saida: true, status: true } });
    const aindaDentro = await tx.visitaTecnico.count({ where: { visitaId: id, estado: "ativo" } });
    if (atual.status === "em_andamento" && atual.saida !== null && aindaDentro === 0) {
      await tx.visita.update({ where: { id }, data: { status: "encerrada" } });
      // Convites que nunca viraram check-in são cancelados ao fechar.
      await tx.visitaTecnico.updateMany({ where: { visitaId: id, estado: "convidado" }, data: { estado: "encerrado" } });
    }
  });
  return paraVisita(await reports.visita.findUniqueOrThrow({ where: { id }, include: INCLUIR }));
}

/**
 * Grava o endereço (CEP) obtido a partir da coordenada do check-in ou do check-out.
 * É o sistema preenchendo um dado derivado: não toca na coordenada nem no resto da visita,
 * não entra no histórico de alterações e vale mesmo para visita encerrada ou travada.
 */
export async function definirEndereco(id: string, momento: "checkin" | "checkout", endereco: EnderecoVisita) {
  const valor = JSON.stringify(endereco);
  if (momento === "checkin") {
    await reports.$executeRaw`UPDATE visitas SET checkin = jsonb_set(checkin, '{endereco}', ${valor}::jsonb) WHERE id = ${id} AND checkin IS NOT NULL`;
  } else {
    await reports.$executeRaw`UPDATE visitas SET checkout = jsonb_set(checkout, '{endereco}', ${valor}::jsonb) WHERE id = ${id} AND checkout IS NOT NULL`;
  }
}

/** Locais (check-in e check-out) ainda sem CEP definitivo, das visitas mais recentes para as mais antigas. */
export async function locaisSemCep(limite: number): Promise<{ visitaId: string; momento: "checkin" | "checkout"; local: LocalVisita }[]> {
  const linhas = await reports.$queryRaw<{ id: string; checkin: LocalVisita | null; checkout: LocalVisita | null }[]>`
    SELECT id, checkin, checkout FROM visitas
    WHERE (checkin IS NOT NULL AND COALESCE(checkin->'endereco'->>'status', 'pendente') IN ('pendente', 'falhou'))
       OR (checkout IS NOT NULL AND COALESCE(checkout->'endereco'->>'status', 'pendente') IN ('pendente', 'falhou'))
    ORDER BY entrada DESC
    LIMIT ${limite}`;
  const pendente = (l: LocalVisita | null): l is LocalVisita => !!l && (!l.endereco || l.endereco.status === "pendente" || l.endereco.status === "falhou");
  return linhas.flatMap((v) =>
    (["checkin", "checkout"] as const).flatMap((momento) => (pendente(v[momento]) ? [{ visitaId: v.id, momento, local: v[momento]! }] : [])),
  );
}

/** Todas as visitas do técnico com entrada no período (ISO inclusive), da mais recente para a mais antiga. */
export async function listarDoTecnico(tecnicoId: string, f: { de?: string; ate?: string } = {}): Promise<VisitaDetalhada[]> {
  return detalharTodas(
    await reports.visita.findMany({ where: { tecnicoId: porIdPlataforma(tecnicoId), ...periodo(f.de, f.ate) }, include: INCLUIR, orderBy: { entrada: "desc" } }),
  );
}

// ---------- Relatórios ----------

/**
 * Visitas que entram num relatório do contrato até a data `ate` (ISO): encerradas e sem relatório
 * (ou já reservadas para `relatorioId`). Inclui as de períodos anteriores que ficaram de fora.
 */
export async function elegiveisParaRelatorio(contratoId: string, ate: string, relatorioId?: string): Promise<Visita[]> {
  const linhas = await reports.visita.findMany({
    where: {
      contratoId,
      status: "encerrada",
      entrada: { lte: new Date(ate) },
      OR: [{ relatorioId: null }, ...(relatorioId ? [{ relatorioId }] : [])],
    },
    include: INCLUIR,
    orderBy: { entrada: "asc" },
  });
  return linhas.map(paraVisita);
}

/** Reserva as visitas para o relatório (e libera as que saíram da lista). Recebe a transação de quem chama, se houver. */
export async function vincularAoRelatorio(relatorioId: string, ids: string[], tx: Prisma.TransactionClient = reports) {
  await tx.visita.updateMany({ where: { relatorioId, id: { notIn: ids } }, data: { relatorioId: null } });
  if (ids.length) await tx.visita.updateMany({ where: { id: { in: ids } }, data: { relatorioId } });
}

export async function buscarVisitasDetalhadas(ids: string[]): Promise<VisitaDetalhada[]> {
  if (!ids.length) return [];
  return detalharTodas(await reports.visita.findMany({ where: { id: { in: ids } }, include: INCLUIR, orderBy: { entrada: "asc" } }));
}
