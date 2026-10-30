import "server-only";
import { Prisma } from "@/generated/reports/client";
import { idPlataforma, idTexto, plataforma, reports } from "@/lib/db";
import { formatarDataHora } from "@/lib/datas";
import { rotuloTipo } from "@/lib/visitas";
import type {
  AlteracaoVisita, EnderecoVisita, EstadoParticipante, Foto, LocalVisita, MeioRegistro, MudancaCampo, PresencaVisita, StatusVisita, TipoVisita,
  UsuarioPublico, Visita, VisitaDetalhada,
} from "@/lib/types";
import { nomesDosClientes } from "./clientes";
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
  presencas: { orderBy: { ordem: "asc" } },
  alteracoes: { orderBy: { em: "asc" } },
  estabelecimento: { select: { nome: true } },
  setor: { select: { nome: true } },
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
  setor: p.setor,
  cpf: p.cpf,
  confirmacao: p.confirmacao as PresencaVisita["confirmacao"],
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
  setorId: v.setorId,
  setorOutro: v.setorOutro,
  tipo: v.tipo as TipoVisita,
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

/** Resolve os nomes de várias visitas com uma consulta por cadastro. */
async function detalharTodas(linhas: Linha[]): Promise<VisitaDetalhada[]> {
  if (!linhas.length) return [];
  const [tecnicos, clientes, sistemas, nomeDoSistema, temas] = await Promise.all([
    nomesDosUsuarios(linhas.map((v) => idTexto(v.tecnicoId))),
    nomesDosClientes(linhas.map((v) => idTexto(v.clienteId))),
    plataforma.clients.findMany({ where: { id: { in: [...new Set(linhas.map((v) => v.contrato.sistemaDoClienteId))] } }, select: { id: true, sistema: true } }),
    nomesDosSistemas(),
    buscarTemasPorIds([...new Set(linhas.flatMap((v) => v.temas.map((t) => t.temaId)))]),
  ]);
  const sistemaDe = new Map(sistemas.map((s) => [s.id, s.sistema]));
  return linhas.map((linha) => {
    const v = paraVisita(linha);
    const sistema = sistemaDe.get(linha.contrato.sistemaDoClienteId) ?? "";
    return {
      ...v,
      tecnicoNome: tecnicos.get(v.tecnicoId) ?? "—",
      clienteNome: clientes.get(v.clienteId) ?? "—",
      sistema,
      sistemaNome: sistema ? nomeDoSistema(sistema) : "—",
      unidadeNome: linha.estabelecimento.nome,
      setorNome: linha.setor?.nome ?? v.setorOutro ?? "—",
      temas: temas.filter((t) => v.temaIds.includes(t.id)),
      travada: linha.relatorio?.status === "aprovado",
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
export async function corrigirPelaAdministracao(id: string, c: CorrecaoVisita, autor: UsuarioPublico, motivo: string): Promise<MudancaCampo[]> {
  const v = await buscarVisita(id);
  if (!v || v.status !== "encerrada") throw new Error("Só visitas encerradas podem ser corrigidas");
  if (v.travada) throw new Error("Visita em relatório aprovado");

  const [temas, unidades, setores] = await Promise.all([
    buscarTemasPorIds([...new Set([...v.temaIds, ...c.temaIds])]),
    reports.estabelecimento.findMany({ where: { id: { in: [v.unidadeId, c.unidadeId] } }, select: { id: true, nome: true } }),
    reports.setor.findMany({ where: { id: { in: [v.setorId, c.setorId].filter((x): x is string => !!x) } }, select: { id: true, nome: true } }),
  ]);
  const nomeTemas = (ids: string[]) => temas.filter((t) => ids.includes(t.id)).map((t) => t.nome).join(", ") || "—";
  const nomeSetor = (setorId: string | null, outro: string | null) => (setorId ? setores.find((s) => s.id === setorId)?.nome : outro) ?? "—";
  const nomeUnidade = (uid: string) => unidades.find((u) => u.id === uid)?.nome ?? "—";

  const mudancas: MudancaCampo[] = [];
  const comparar = (campo: string, antes: string, depois: string) => {
    if (antes !== depois) mudancas.push({ campo, antes: antes || "—", depois: depois || "—" });
  };

  comparar("Entrada", formatarDataHora(v.entrada), formatarDataHora(c.entrada));
  comparar("Saída", v.saida ? formatarDataHora(v.saida) : "", formatarDataHora(c.saida));
  comparar("Tipo", rotuloTipo(v.tipo), rotuloTipo(c.tipo));
  comparar("Estabelecimento", nomeUnidade(v.unidadeId), nomeUnidade(c.unidadeId));
  comparar("Setor", nomeSetor(v.setorId, v.setorOutro), nomeSetor(c.setorId, c.setorOutro));
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
  await reports.$transaction(async (tx) => {
    // Só grava se a visita continua encerrada e fora de relatório aprovado.
    const { count } = await tx.visita.updateMany({
      where: { id, status: "encerrada", OR: [{ relatorioId: null }, { relatorio: { status: { not: "aprovado" } } }] },
      data: {
        entrada: new Date(c.entrada),
        saida: new Date(c.saida),
        tipo: c.tipo,
        estabelecimentoId: c.unidadeId,
        setorId: c.setorId,
        setorOutro: c.setorOutro,
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
    if (presencasRemovidas.length) {
      await tx.presenca.deleteMany({ where: { visitaId: id, participanteId: { in: presencasRemovidas.map((p) => idPlataforma(p.participanteId)!) } } });
    }
    await tx.alteracaoVisita.create({ data: registro(id, autor, "correcao", motivo, mudancas) });
  });
  return mudancas;
}

// ---------- App do Técnico ----------

/** A visita em andamento do técnico, se houver (só pode existir uma). */
export async function visitaAbertaDoTecnico(tecnicoId: string): Promise<VisitaDetalhada | null> {
  return detalhar(await reports.visita.findFirst({ where: { tecnicoId: porIdPlataforma(tecnicoId), status: "em_andamento" }, include: INCLUIR }));
}

export type DadosCheckin = Pick<
  Visita,
  | "tecnicoId" | "clienteId" | "contratoId" | "unidadeId" | "setorId" | "setorOutro" | "tipo" | "checkin" | "meio" | "distanciaCheckinM" | "raioCheckinM"
  | "fotoAmbiente" | "printTela" | "linkReuniao"
>;

const JA_TEM_ABERTA = "Técnico já tem uma visita em andamento";

/** Abre a visita com a hora do servidor. Recusa se o técnico já tem uma visita aberta. */
export async function abrirVisita(d: DadosCheckin): Promise<Visita> {
  const tecnicoId = idPlataforma(d.tecnicoId);
  const clienteId = idPlataforma(d.clienteId);
  if (tecnicoId === null || clienteId === null) throw new Error("Técnico ou cliente inválido");
  if (await reports.visita.count({ where: { tecnicoId, status: "em_andamento" } })) throw new Error(JA_TEM_ABERTA);
  try {
    const v = await reports.visita.create({
      data: {
        id: crypto.randomUUID(),
        tecnicoId,
        clienteId,
        contratoId: d.contratoId,
        estabelecimentoId: d.unidadeId,
        setorId: d.setorId,
        setorOutro: d.setorOutro,
        tipo: d.tipo,
        status: "em_andamento",
        entrada: new Date(),
        checkin: json(d.checkin),
        meio: d.meio,
        distanciaCheckinM: d.distanciaCheckinM,
        raioCheckinM: d.raioCheckinM,
        fotoAmbiente: json(d.fotoAmbiente),
        printTela: json(d.printTela),
        linkReuniao: d.linkReuniao,
      },
      include: INCLUIR,
    });
    return paraVisita(v);
  } catch (e) {
    // Dois check-ins ao mesmo tempo: o índice único parcial recusa o segundo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error(JA_TEM_ABERTA);
    throw e;
  }
}

/** Visita em andamento do próprio técnico (para alterações durante a visita). */
async function abertaDe(id: string, tecnicoId: string) {
  const v = await reports.visita.findUnique({ where: { id }, select: { id: true, tecnicoId: true, status: true, fotosExtras: true } });
  if (!v || idTexto(v.tecnicoId) !== tecnicoId) throw new Error("Visita não encontrada");
  if (v.status !== "em_andamento") throw new Error("A visita já foi encerrada");
  return v;
}

export async function definirTemas(id: string, tecnicoId: string, temaIds: string[]) {
  await abertaDe(id, tecnicoId);
  await reports.$transaction([
    reports.visitaTema.deleteMany({ where: { visitaId: id } }),
    reports.visitaTema.createMany({ data: [...new Set(temaIds)].map((temaId) => ({ visitaId: id, temaId })) }),
  ]);
}

export async function definirTemaAdicional(id: string, tecnicoId: string, texto: string) {
  await abertaDe(id, tecnicoId);
  await reports.visita.update({ where: { id }, data: { temaAdicional: texto } });
}

export async function adicionarFotoExtra(id: string, tecnicoId: string, foto: Foto) {
  await abertaDe(id, tecnicoId);
  // Acrescenta no próprio banco: dois envios ao mesmo tempo não se sobrescrevem.
  await reports.$executeRaw`UPDATE visitas SET fotos_extras = fotos_extras || ${JSON.stringify([foto])}::jsonb WHERE id = ${id}`;
}

export async function removerFotoExtra(id: string, tecnicoId: string, fotoId: string) {
  await abertaDe(id, tecnicoId);
  await reports.$executeRaw`
    UPDATE visitas
    SET fotos_extras = COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements(fotos_extras) f WHERE f->>'id' <> ${fotoId}), '[]'::jsonb)
    WHERE id = ${id}`;
}

export async function adicionarPresenca(id: string, tecnicoId: string, p: PresencaVisita) {
  await abertaDe(id, tecnicoId);
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
        setor: p.setor,
        cpf: p.cpf,
        confirmacao: p.confirmacao,
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
  await abertaDe(id, tecnicoId);
  const chave = idPlataforma(participanteId);
  if (chave !== null) await reports.presenca.deleteMany({ where: { visitaId: id, participanteId: chave } });
}

export interface DadosCheckout {
  checkout: Visita["checkout"];
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
}

/** Check-out pelo técnico: saída com a hora do servidor; depois disso a visita não é mais editável por ele. */
export async function encerrarPeloTecnico(id: string, tecnicoId: string, d: DadosCheckout): Promise<Visita> {
  await abertaDe(id, tecnicoId);
  const { count } = await reports.visita.updateMany({
    where: { id, status: "em_andamento" },
    data: { checkout: json(d.checkout), observacoes: d.observacoes, pendencias: d.pendencias, proximosPassos: d.proximosPassos, status: "encerrada", saida: new Date() },
  });
  if (!count) throw new Error("A visita já foi encerrada");
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
