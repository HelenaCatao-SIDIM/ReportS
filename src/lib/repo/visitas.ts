import "server-only";
import { formatarDataHora } from "@/lib/datas";
import { rotuloTipo } from "@/lib/visitas";
import type { AlteracaoVisita, EnderecoVisita, Foto, MudancaCampo, PresencaVisita, Tema, TipoVisita, UsuarioPublico, Visita, VisitaDetalhada } from "@/lib/types";
import { buscarCliente, buscarUnidade, buscarSetor } from "./clientes";
import { listarTemas } from "./temas";
import { buscarPorId as buscarUsuario } from "./usuarios";
import { relatorioAprovado } from "./relatorios-dados";

/*
 * Repositório de visitas — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */


const ASSINATURA = "/mock/assinatura.png";

const foto = (n: number): Foto => ({ id: `f${n}-${Math.random().toString(36).slice(2, 7)}`, url: `/mock/foto-${n}.png` });

const presenca = (p: Omit<PresencaVisita, "assinatura" | "confirmacao">, assinada: boolean): PresencaVisita => ({
  ...p,
  confirmacao: assinada ? "assinatura" : "nominal",
  assinatura: assinada ? ASSINATURA : null,
});

const LUCIANA = { participanteId: "p1", nome: "Luciana Ferraz", cbo: { codigo: "411010", titulo: "Assistente administrativo" }, setor: "Protocolo", cpf: "12345678909" };
const PATRICIA = { participanteId: "p3", nome: "Patrícia Gomes", cbo: { codigo: "252405", titulo: "Analista de recursos humanos" }, setor: "Recursos Humanos", cpf: "11144477735" };
const SANDRA = { participanteId: "p4", nome: "Sandra Moura", cbo: { codigo: "223505", titulo: "Enfermeiro" }, setor: "Recepção", cpf: "52998224725" };

function base(v: Partial<Visita> & Pick<Visita, "id" | "tecnicoId" | "clienteId" | "unidadeId" | "tipo" | "status" | "entrada">): Visita {
  return {
    setorId: null, setorOutro: null, saida: null, checkin: null, checkout: null, meio: "celular", distanciaCheckinM: null, raioCheckinM: null, fotoAmbiente: null, printTela: null, linkReuniao: null,
    temaIds: [], temaAdicional: "", fotosExtras: [], presencas: [], observacoes: "", pendencias: "", proximosPassos: "",
    encerradaPorGestor: false, relatorioId: null, historico: [],
    ...v,
  };
}

function seed(): Visita[] {
  const agora = Date.now();
  const haHoras = (h: number) => new Date(agora - h * 3600_000).toISOString();
  // Um objeto por visita: o CEP é gravado dentro do local (definirEndereco), então não pode ser compartilhado.
  const coords = () => ({ latitude: -22.9035, longitude: -47.0621 });
  // ~178 m ao sul da Sede da Prefeitura (raio de 50 m): exemplo de check-in fora do raio.
  const coordsLonge = () => ({ latitude: -22.9051, longitude: -47.0621 });
  const noLocal = { distanciaCheckinM: 0, raioCheckinM: 50 };

  return [
    base({
      id: "v1", tecnicoId: "u2", clienteId: "c1", unidadeId: "un1", setorId: "s1", tipo: "suporte_presencial", status: "em_andamento",
      entrada: haHoras(2), checkin: coords(), ...noLocal, fotoAmbiente: foto(1), temaIds: ["t1"],
    }),
    base({
      id: "v2", tecnicoId: "u3", clienteId: "c2", unidadeId: "un3", setorId: "s6", tipo: "implantacao", status: "em_andamento",
      entrada: haHoras(26), checkin: coords(), fotoAmbiente: foto(2),
    }),
    base({
      id: "v3", tecnicoId: "u2", clienteId: "c1", unidadeId: "un1", setorId: "s2", tipo: "treinamento", status: "encerrada",
      entrada: "2026-10-06T13:00:00.000Z", saida: "2026-10-06T16:30:00.000Z", checkin: coords(), ...noLocal, checkout: coords(),
      fotoAmbiente: foto(3), fotosExtras: [foto(4), foto(5)], temaIds: ["t4", "t5"], temaAdicional: "Dúvidas sobre consignados",
      presencas: [presenca(PATRICIA, true), presenca(LUCIANA, true)],
      observacoes: "Treinamento realizado com a equipe de RH. Boa participação.",
      pendencias: "Enviar o manual de cálculo de férias atualizado.",
      proximosPassos: "Acompanhar o fechamento da folha de outubro.",
    }),
    base({
      id: "v4", tecnicoId: "u3", clienteId: "c1", unidadeId: "un2", setorId: "s5", tipo: "treinamento_online", status: "encerrada",
      meio: "computador", entrada: "2026-10-09T17:00:00.000Z", saida: "2026-10-09T18:30:00.000Z", printTela: foto(6), linkReuniao: "https://meet.example/abc-defg-hij",
      temaIds: ["t8"], presencas: [presenca(SANDRA, false)],
      observacoes: "Treinamento online de dispensação.", proximosPassos: "Agendar a turma da tarde.",
    }),
    base({
      id: "v5", tecnicoId: "u2", clienteId: "c2", unidadeId: "un3", setorId: "s6", tipo: "reuniao", status: "encerrada",
      entrada: "2026-10-14T12:00:00.000Z", saida: "2026-10-14T13:00:00.000Z", checkin: coords(), checkout: coords(), fotoAmbiente: foto(2),
      observacoes: "Reunião de alinhamento da implantação.", pendencias: "Cliente enviar a planilha de convênios.",
    }),
    base({
      id: "v6", tecnicoId: "u3", clienteId: "c1", unidadeId: "un1", setorOutro: "Gabinete do Prefeito", tipo: "visita_tecnica", status: "encerrada",
      entrada: "2026-10-20T14:00:00.000Z", saida: "2026-10-20T15:10:00.000Z", checkin: coordsLonge(), distanciaCheckinM: 178, raioCheckinM: 50, fotoAmbiente: foto(5), encerradaPorGestor: true,
      historico: [
        {
          id: "h1", autorId: "u1", autorNome: "Gestor SIDIM", em: "2026-10-21T11:00:00.000Z", acao: "encerramento",
          motivo: "Técnico esqueceu de fazer o check-out; saída confirmada por telefone.",
          mudancas: [{ campo: "Saída", antes: "—", depois: "20/10/2026 12:10" }],
        },
      ],
    }),
    base({
      id: "v7", tecnicoId: "u2", clienteId: "c2", unidadeId: "un3", setorId: "s6", tipo: "suporte_presencial", status: "cancelada",
      entrada: "2026-10-21T13:00:00.000Z", checkin: coords(), fotoAmbiente: foto(1),
      historico: [
        {
          id: "h2", autorId: "u1", autorNome: "Gestor SIDIM", em: "2026-10-21T13:20:00.000Z", acao: "cancelamento",
          motivo: "Check-in feito por engano no cliente errado.", mudancas: [{ campo: "Situação", antes: "Em andamento", depois: "Cancelada" }],
        },
      ],
    }),
    base({
      id: "v8", tecnicoId: "u2", clienteId: "c1", unidadeId: "un1", setorId: "s3", tipo: "suporte_presencial", status: "encerrada",
      entrada: "2026-09-15T12:30:00.000Z", saida: "2026-09-15T15:00:00.000Z", checkin: coords(), ...noLocal, checkout: coords(), fotoAmbiente: foto(4),
      temaIds: ["t2", "t3"], observacoes: "Suporte na emissão de guias.", relatorioId: "r-2026-09-c1",
    }),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __visitas?: Visita[] };
const visitas = (g.__visitas ??= seed());

// ---------- Consultas ----------

export type { VisitaDetalhada };

async function detalhar(v: Visita, temas?: Tema[]): Promise<VisitaDetalhada> {
  const [tecnico, cliente, unidade, setor, todos] = await Promise.all([
    buscarUsuario(v.tecnicoId),
    buscarCliente(v.clienteId),
    buscarUnidade(v.unidadeId),
    v.setorId ? buscarSetor(v.setorId) : null,
    temas ?? listarTemas(),
  ]);
  return {
    ...v,
    tecnicoNome: tecnico?.nome ?? "—",
    clienteNome: cliente?.nome ?? "—",
    unidadeNome: unidade?.nome ?? "—",
    setorNome: setor?.nome ?? v.setorOutro ?? "—",
    temas: todos.filter((t) => v.temaIds.includes(t.id)),
    travada: relatorioAprovado(v.relatorioId),
  };
}

async function detalharTodas(lista: Visita[]) {
  const temas = await listarTemas();
  return Promise.all(lista.map((v) => detalhar(v, temas)));
}

/** Em andamento, da mais antiga para a mais recente (as esquecidas aparecem primeiro). */
export async function listarEmAndamento(): Promise<VisitaDetalhada[]> {
  return detalharTodas(visitas.filter((v) => v.status === "em_andamento").sort((a, b) => a.entrada.localeCompare(b.entrada)));
}

export interface FiltroVisitas {
  clienteId?: string;
  tecnicoId?: string;
  /** ISO inclusive. */
  de?: string;
  ate?: string;
  incluirCanceladas?: boolean;
}

/** Encerradas (e, opcionalmente, canceladas), da mais recente para a mais antiga. */
export async function listarEncerradas(f: FiltroVisitas = {}): Promise<VisitaDetalhada[]> {
  return detalharTodas(
    visitas
      .filter((v) => v.status === "encerrada" || (f.incluirCanceladas && v.status === "cancelada"))
      .filter((v) => !f.clienteId || v.clienteId === f.clienteId)
      .filter((v) => !f.tecnicoId || v.tecnicoId === f.tecnicoId)
      .filter((v) => !f.de || v.entrada >= f.de)
      .filter((v) => !f.ate || v.entrada <= f.ate)
      .sort((a, b) => b.entrada.localeCompare(a.entrada)),
  );
}

export async function buscarVisita(id: string): Promise<VisitaDetalhada | null> {
  const v = visitas.find((x) => x.id === id);
  return v ? detalhar(v) : null;
}

// ---------- Alterações pelo gestor ----------

function registrar(v: Visita, autor: UsuarioPublico, acao: AlteracaoVisita["acao"], motivo: string, mudancas: MudancaCampo[]) {
  v.historico.push({ id: crypto.randomUUID(), autorId: autor.id, autorNome: autor.nome, em: new Date().toISOString(), acao, motivo, mudancas });
}

/** Encerra uma visita esquecida aberta, com o horário de saída informado pelo gestor. */
export async function encerrarPeloGestor(id: string, saida: string, autor: UsuarioPublico, justificativa: string) {
  const v = visitas.find((x) => x.id === id);
  if (!v || v.status !== "em_andamento") throw new Error("Visita não está em andamento");
  v.status = "encerrada";
  v.saida = saida;
  v.encerradaPorGestor = true;
  registrar(v, autor, "encerramento", justificativa, [{ campo: "Saída", antes: "—", depois: formatarDataHora(saida) }]);
}

/** Cancela um check-in feito por engano. A visita não entra em relatório. */
export async function cancelarPeloGestor(id: string, autor: UsuarioPublico, justificativa: string) {
  const v = visitas.find((x) => x.id === id);
  if (!v || v.status !== "em_andamento") throw new Error("Visita não está em andamento");
  v.status = "cancelada";
  registrar(v, autor, "cancelamento", justificativa, [{ campo: "Situação", antes: "Em andamento", depois: "Cancelada" }]);
}

export interface CorrecaoVisita {
  entrada: string;
  saida: string;
  tipo: TipoVisita;
  unidadeId: string;
  setorId: string | null;
  setorOutro: string | null;
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
export async function corrigirPeloGestor(id: string, c: CorrecaoVisita, autor: UsuarioPublico, motivo: string): Promise<MudancaCampo[]> {
  const v = visitas.find((x) => x.id === id);
  if (!v || v.status !== "encerrada") throw new Error("Só visitas encerradas podem ser corrigidas");
  if (relatorioAprovado(v.relatorioId)) throw new Error("Visita em relatório aprovado");

  const temas = await listarTemas();
  const nomeTemas = (ids: string[]) => temas.filter((t) => ids.includes(t.id)).map((t) => t.nome).join(", ") || "—";
  const nomeSetor = async (setorId: string | null, outro: string | null) => (setorId ? (await buscarSetor(setorId))?.nome : outro) ?? "—";
  const nomeUnidade = async (uid: string) => (await buscarUnidade(uid))?.nome ?? "—";

  const mudancas: MudancaCampo[] = [];
  const comparar = (campo: string, antes: string, depois: string) => {
    if (antes !== depois) mudancas.push({ campo, antes: antes || "—", depois: depois || "—" });
  };

  comparar("Entrada", formatarDataHora(v.entrada), formatarDataHora(c.entrada));
  comparar("Saída", v.saida ? formatarDataHora(v.saida) : "", formatarDataHora(c.saida));
  comparar("Tipo", rotuloTipo(v.tipo), rotuloTipo(c.tipo));
  comparar("Estabelecimento", await nomeUnidade(v.unidadeId), await nomeUnidade(c.unidadeId));
  comparar("Setor", await nomeSetor(v.setorId, v.setorOutro), await nomeSetor(c.setorId, c.setorOutro));
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

  Object.assign(v, {
    entrada: c.entrada,
    saida: c.saida,
    tipo: c.tipo,
    unidadeId: c.unidadeId,
    setorId: c.setorId,
    setorOutro: c.setorOutro,
    temaIds: c.temaIds,
    temaAdicional: c.temaAdicional,
    observacoes: c.observacoes,
    pendencias: c.pendencias,
    proximosPassos: c.proximosPassos,
    presencas: v.presencas.filter((p) => !c.removerPresencas.includes(p.participanteId)),
    fotosExtras: v.fotosExtras.filter((f) => !c.removerFotos.includes(f.id)),
  });
  registrar(v, autor, "correcao", motivo, mudancas);
  return mudancas;
}

// ---------- App do Técnico ----------

/** A visita em andamento do técnico, se houver (só pode existir uma). */
export async function visitaAbertaDoTecnico(tecnicoId: string): Promise<VisitaDetalhada | null> {
  const v = visitas.find((x) => x.tecnicoId === tecnicoId && x.status === "em_andamento");
  return v ? detalhar(v) : null;
}

export type DadosCheckin = Pick<
  Visita,
  | "tecnicoId" | "clienteId" | "unidadeId" | "setorId" | "setorOutro" | "tipo" | "checkin" | "meio" | "distanciaCheckinM" | "raioCheckinM"
  | "fotoAmbiente" | "printTela" | "linkReuniao"
>;

/** Abre a visita com a hora do servidor. Recusa se o técnico já tem uma visita aberta. */
export async function abrirVisita(d: DadosCheckin): Promise<Visita> {
  if (visitas.some((x) => x.tecnicoId === d.tecnicoId && x.status === "em_andamento")) {
    throw new Error("Técnico já tem uma visita em andamento");
  }
  const v = base({ ...d, id: crypto.randomUUID(), status: "em_andamento", entrada: new Date().toISOString() });
  visitas.push(v);
  return v;
}

/** Visita em andamento do próprio técnico (para alterações durante a visita). */
function abertaDe(id: string, tecnicoId: string): Visita {
  const v = visitas.find((x) => x.id === id);
  if (!v || v.tecnicoId !== tecnicoId) throw new Error("Visita não encontrada");
  if (v.status !== "em_andamento") throw new Error("A visita já foi encerrada");
  return v;
}

export async function definirTemas(id: string, tecnicoId: string, temaIds: string[]) {
  abertaDe(id, tecnicoId).temaIds = [...new Set(temaIds)];
}

export async function definirTemaAdicional(id: string, tecnicoId: string, texto: string) {
  abertaDe(id, tecnicoId).temaAdicional = texto;
}

export async function adicionarFotoExtra(id: string, tecnicoId: string, foto: Foto) {
  abertaDe(id, tecnicoId).fotosExtras.push(foto);
}

export async function removerFotoExtra(id: string, tecnicoId: string, fotoId: string) {
  const v = abertaDe(id, tecnicoId);
  v.fotosExtras = v.fotosExtras.filter((f) => f.id !== fotoId);
}

export async function adicionarPresenca(id: string, tecnicoId: string, p: PresencaVisita) {
  const v = abertaDe(id, tecnicoId);
  if (v.presencas.some((x) => x.participanteId === p.participanteId)) throw new Error("Participante já está na lista");
  v.presencas.push(p);
}

export async function removerPresenca(id: string, tecnicoId: string, participanteId: string) {
  const v = abertaDe(id, tecnicoId);
  v.presencas = v.presencas.filter((p) => p.participanteId !== participanteId);
}

export interface DadosCheckout {
  checkout: Visita["checkout"];
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
}

/** Check-out pelo técnico: saída com a hora do servidor; depois disso a visita não é mais editável por ele. */
export async function encerrarPeloTecnico(id: string, tecnicoId: string, d: DadosCheckout): Promise<Visita> {
  const v = abertaDe(id, tecnicoId);
  Object.assign(v, d, { status: "encerrada", saida: new Date().toISOString() });
  return v;
}

/**
 * Grava o endereço (CEP) obtido a partir da coordenada do check-in ou do check-out.
 * É o sistema preenchendo um dado derivado: não toca na coordenada nem no resto da visita,
 * não entra no histórico de alterações e vale mesmo para visita encerrada ou travada.
 */
export async function definirEndereco(id: string, momento: "checkin" | "checkout", endereco: EnderecoVisita) {
  const local = visitas.find((x) => x.id === id)?.[momento];
  if (local) local.endereco = endereco;
}

/** Todas as visitas do técnico com entrada no período (ISO inclusive), da mais recente para a mais antiga. */
export async function listarDoTecnico(tecnicoId: string, f: { de?: string; ate?: string } = {}): Promise<VisitaDetalhada[]> {
  return detalharTodas(
    visitas
      .filter((v) => v.tecnicoId === tecnicoId)
      .filter((v) => !f.de || v.entrada >= f.de)
      .filter((v) => !f.ate || v.entrada <= f.ate)
      .sort((a, b) => b.entrada.localeCompare(a.entrada)),
  );
}


// ---------- Relatórios ----------

/**
 * Visitas que entram num relatório do cliente até a data `ate` (ISO): encerradas e sem relatório
 * (ou já reservadas para `relatorioId`). Inclui as de períodos anteriores que ficaram de fora.
 */
export async function elegiveisParaRelatorio(clienteId: string, ate: string, relatorioId?: string): Promise<Visita[]> {
  return visitas
    .filter((v) => v.clienteId === clienteId && v.status === "encerrada" && v.entrada <= ate)
    .filter((v) => v.relatorioId === null || v.relatorioId === relatorioId)
    .sort((a, b) => a.entrada.localeCompare(b.entrada));
}

/** Reserva as visitas para o relatório (e libera as que saíram da lista). */
export async function vincularAoRelatorio(relatorioId: string, ids: string[]) {
  for (const v of visitas) {
    if (ids.includes(v.id)) v.relatorioId = relatorioId;
    else if (v.relatorioId === relatorioId) v.relatorioId = null;
  }
}

export async function buscarVisitasDetalhadas(ids: string[]): Promise<VisitaDetalhada[]> {
  return detalharTodas(visitas.filter((v) => ids.includes(v.id)).sort((a, b) => a.entrada.localeCompare(b.entrada)));
}
