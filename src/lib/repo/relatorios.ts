import "server-only";
import { Prisma } from "@/generated/reports/client";
import { idPlataforma, idTexto, reports } from "@/lib/db";
import { fimDoDia, inicioDoDia } from "@/lib/datas";
import { ehPresencial } from "@/lib/visitas";
import type { Cliente, ConteudoCongelado, DecisaoRelatorio, Relatorio, StatusRelatorio, TokenAprovacao, VersaoRelatorio } from "@/lib/types";
import { buscarCliente } from "./clientes";
import { aprovadoresAtivosDoContrato, buscarContrato, listarContratos, type ContratoDetalhado } from "./contratos";
import { buscarVisitasDetalhadas, elegiveisParaRelatorio, vincularAoRelatorio, type VisitaDetalhada } from "./visitas";

/*
 * Relatórios, versões emitidas e links de aprovação — banco do ReportS.
 * As visitas do relatório são as que apontam para ele (visitas.relatorio_id); cada versão guarda as suas e o
 * conteúdo congelado na emissão. O período é guardado como data (AAAA-MM-DD, horário de Brasília).
 */

const INCLUIR = {
  versoes: { orderBy: { numero: "asc" } },
  visitas: { select: { id: true }, orderBy: { entrada: "asc" } },
} as const;

type Linha = Prisma.RelatorioGetPayload<{ include: typeof INCLUIR }>;

const data = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dia = (d: Date) => d.toISOString().slice(0, 10);

const paraVersao = (v: Linha["versoes"][number]): VersaoRelatorio => ({
  numero: v.numero,
  emitidoEm: v.emitidoEm.toISOString(),
  visitaIds: v.visitaIds as string[],
  pdfUrl: v.pdfUrl,
  pdfTamanho: v.pdfTamanho,
  enviadoPara: v.enviadoPara as VersaoRelatorio["enviadoPara"],
  conteudo: v.conteudo as unknown as ConteudoCongelado | null,
  decisao: v.decisao as unknown as DecisaoRelatorio | null,
});

const paraRelatorio = (r: Linha): Relatorio => ({
  id: r.id,
  clienteId: idTexto(r.clienteId),
  contratoId: r.contratoId,
  de: dia(r.de),
  ate: dia(r.ate),
  status: r.status as StatusRelatorio,
  visitaIds: r.visitas.map((v) => v.id),
  versoes: r.versoes.map(paraVersao),
  criadoEm: r.criadoEm.toISOString(),
  atualizadoEm: r.atualizadoEm.toISOString(),
});

const paraLink = (t: { token: string; relatorioId: string; versao: number; aprovadorNome: string; aprovadorCargo: string; aprovadorEmail: string; criadoEm: Date; invalidadoEm: Date | null }): TokenAprovacao => ({
  token: t.token,
  relatorioId: t.relatorioId,
  versao: t.versao,
  aprovadorNome: t.aprovadorNome,
  aprovadorCargo: t.aprovadorCargo,
  aprovadorEmail: t.aprovadorEmail,
  criadoEm: t.criadoEm.toISOString(),
  invalidadoEm: t.invalidadoEm?.toISOString() ?? null,
});

export interface RelatorioResumo extends Relatorio {
  clienteNome: string;
  sistemaNome: string;
  versaoAtual: number;
}

export interface FiltroRelatorios {
  clienteId?: string;
  contratoId?: string;
  /** AAAA-MM-DD: relatórios cujo período cruza o intervalo. */
  de?: string;
  ate?: string;
}

/** Painel: mais recentes (última movimentação) primeiro. */
export async function listarRelatorios(f: FiltroRelatorios = {}): Promise<RelatorioResumo[]> {
  const [linhas, contratos] = await Promise.all([
    reports.relatorio.findMany({
      where: {
        ...(f.clienteId ? { clienteId: idPlataforma(f.clienteId) ?? BigInt(-1) } : {}),
        ...(f.contratoId ? { contratoId: f.contratoId } : {}),
        ...(f.de ? { ate: { gte: data(f.de) } } : {}),
        ...(f.ate ? { de: { lte: data(f.ate) } } : {}),
      },
      include: INCLUIR,
      orderBy: { atualizadoEm: "desc" },
    }),
    listarContratos(),
  ]);
  const contratoDe = new Map(contratos.map((c) => [c.id, c]));
  return linhas.map((linha) => {
    const r = paraRelatorio(linha);
    const contrato = contratoDe.get(r.contratoId);
    return { ...r, clienteNome: contrato?.clienteNome ?? "—", sistemaNome: contrato?.sistemaNome ?? "—", versaoAtual: r.versoes.length };
  });
}

export async function buscarRelatorio(id: string): Promise<Relatorio | null> {
  const r = await reports.relatorio.findUnique({ where: { id }, include: INCLUIR });
  return r ? paraRelatorio(r) : null;
}

/** Outro relatório do mesmo contrato cujo período cruza [de, ate]. */
export async function periodoSobreposto(contratoId: string, de: string, ate: string, excetoId?: string): Promise<Relatorio | null> {
  const r = await reports.relatorio.findFirst({
    where: { contratoId, de: { lte: data(ate) }, ate: { gte: data(de) }, ...(excetoId ? { NOT: { id: excetoId } } : {}) },
    include: INCLUIR,
  });
  return r ? paraRelatorio(r) : null;
}

const idsElegiveis = async (r: Pick<Relatorio, "contratoId" | "ate" | "id">) =>
  (await elegiveisParaRelatorio(r.contratoId, fimDoDia(r.ate), r.id)).map((v) => v.id);

/** Cria o rascunho e reserva as visitas. Recusa sobreposição e período sem visitas. */
export async function criarRascunho(contratoId: string, de: string, ate: string): Promise<{ relatorio: Relatorio } | { erro: string }> {
  const contrato = await buscarContrato(contratoId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  const conflito = await periodoSobreposto(contratoId, de, ate);
  if (conflito) return { erro: `Já existe um relatório deste contrato (${contrato.sistemaNome}) de ${conflito.de.split("-").reverse().join("/")} a ${conflito.ate.split("-").reverse().join("/")}, que cruza este período.` };

  const id = crypto.randomUUID();
  const ids = await idsElegiveis({ contratoId, ate, id });
  if (!ids.length) return { erro: `Nenhuma visita encerrada deste contrato (${contrato.sistemaNome}) até o fim do período (fora de outros relatórios).` };

  await reports.$transaction(async (tx) => {
    await tx.relatorio.create({ data: { id, clienteId: idPlataforma(contrato.clienteId)!, contratoId, de: data(de), ate: data(ate), status: "rascunho" } });
    // Só reserva as que continuam livres (outra pessoa pode ter criado um relatório ao mesmo tempo).
    await tx.visita.updateMany({ where: { id: { in: ids }, relatorioId: null }, data: { relatorioId: id } });
  });
  return { relatorio: (await buscarRelatorio(id))! };
}

/** Recalcula as visitas do rascunho (ex.: uma visita esquecida foi encerrada depois). */
export async function atualizarVisitasDoRascunho(id: string): Promise<{ antes: number; depois: number }> {
  const r = await buscarRelatorio(id);
  if (!r || r.status === "aprovado" || r.status === "enviado") throw new Error("Só rascunhos (ou relatórios em ajuste) podem ser recalculados");
  const antes = r.visitaIds.length;
  const ids = await idsElegiveis(r);
  await reports.$transaction(async (tx) => {
    await vincularAoRelatorio(r.id, ids, tx);
    await tx.relatorio.update({ where: { id }, data: { atualizadoEm: new Date() } });
  });
  return { antes, depois: ids.length };
}

/** Exclui um rascunho que nunca foi emitido e libera as visitas. */
export async function excluirRascunho(id: string) {
  await reports.$transaction(async (tx) => {
    const r = await tx.relatorio.findUnique({ where: { id }, select: { status: true, _count: { select: { versoes: true } } } });
    if (!r || r.status !== "rascunho" || r._count.versoes) throw new Error("Só rascunhos nunca emitidos podem ser excluídos");
    await vincularAoRelatorio(id, [], tx);
    await tx.relatorio.delete({ where: { id } });
  });
}

// ---------- Conteúdo ----------

export interface ConteudoRelatorio {
  relatorio: Relatorio;
  cliente: Cliente;
  contrato: ContratoDetalhado;
  visitas: VisitaDetalhada[];
  /** Visitas com data anterior ao início do período (ficaram de fora do relatório anterior). */
  deOutroPeriodo: Set<string>;
  minutosPresenciais: number;
  minutosOnline: number;
}

const minutos = (v: VisitaDetalhada) => (v.saida ? Math.round((new Date(v.saida).getTime() - new Date(v.entrada).getTime()) / 60000) : 0);

export async function montarConteudo(id: string): Promise<ConteudoRelatorio | null> {
  const relatorio = await buscarRelatorio(id);
  if (!relatorio) return null;
  const [cliente, contrato, visitas] = await Promise.all([
    buscarCliente(relatorio.clienteId),
    buscarContrato(relatorio.contratoId),
    buscarVisitasDetalhadas(relatorio.visitaIds),
  ]);
  if (!cliente || !contrato) return null;
  const inicio = inicioDoDia(relatorio.de);
  return {
    relatorio,
    cliente,
    contrato,
    visitas,
    deOutroPeriodo: new Set(visitas.filter((v) => v.entrada < inicio).map((v) => v.id)),
    minutosPresenciais: visitas.filter((v) => ehPresencial(v.tipo)).reduce((s, v) => s + minutos(v), 0),
    minutosOnline: visitas.filter((v) => !ehPresencial(v.tipo)).reduce((s, v) => s + minutos(v), 0),
  };
}

// ---------- Emissão ----------

/** Congela o conteúdo atual (cópia serializável) para a versão que será emitida. */
export function congelar(c: ConteudoRelatorio): ConteudoCongelado {
  return structuredClone({
    cliente: { nome: c.cliente.nome, cnpj: c.cliente.cnpj, contrato: c.contrato.texto },
    sistema: { codigo: c.contrato.sistema, nome: c.contrato.sistemaNome },
    de: c.relatorio.de,
    ate: c.relatorio.ate,
    visitas: c.visitas,
    deOutroPeriodo: [...c.deOutroPeriodo],
    minutosPresenciais: c.minutosPresenciais,
    minutosOnline: c.minutosOnline,
  });
}

/** Token do link de aprovação: 64 caracteres aleatórios. */
const novoToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

/**
 * Registra a nova versão (v1, v2…), muda o status para "enviado", invalida os links da versão anterior
 * e cria um link por aprovador, numa transação. Devolve a versão e os links criados.
 */
export async function registrarEmissao(
  id: string,
  dados: { conteudo: ConteudoCongelado; pdfUrl: string; pdfTamanho: number; emitidoEm: string },
): Promise<{ versao: VersaoRelatorio; links: TokenAprovacao[] }> {
  const r = await buscarRelatorio(id);
  if (!r || (r.status !== "rascunho" && r.status !== "ajuste_solicitado")) throw new Error("Este relatório não pode ser emitido agora");
  const aprovadores = await aprovadoresAtivosDoContrato(r.contratoId);
  if (!aprovadores.length) throw new Error("O contrato não tem aprovadores ativos");

  const emitidoEm = new Date(dados.emitidoEm);
  const versao: VersaoRelatorio = {
    numero: r.versoes.length + 1,
    emitidoEm: dados.emitidoEm,
    visitaIds: [...r.visitaIds],
    pdfUrl: dados.pdfUrl,
    pdfTamanho: dados.pdfTamanho,
    enviadoPara: aprovadores.map((a) => ({ nome: a.nome, email: a.email })),
    conteudo: dados.conteudo,
    decisao: null,
  };
  const links = aprovadores.map((a) => ({
    token: novoToken(),
    relatorioId: id,
    versao: versao.numero,
    aprovadorId: a.id,
    aprovadorNome: a.nome,
    aprovadorCargo: a.cargo,
    aprovadorEmail: a.email,
    criadoEm: emitidoEm,
    invalidadoEm: null,
  }));

  await reports.$transaction(async (tx) => {
    // Duas emissões ao mesmo tempo: só a primeira muda o status; a segunda para aqui.
    const { count } = await tx.relatorio.updateMany({
      where: { id, status: { in: ["rascunho", "ajuste_solicitado"] } },
      data: { status: "enviado", atualizadoEm: emitidoEm },
    });
    if (!count) throw new Error("Este relatório não pode ser emitido agora");
    await tx.versaoRelatorio.create({
      data: {
        id: crypto.randomUUID(),
        relatorioId: id,
        numero: versao.numero,
        emitidoEm,
        visitaIds: versao.visitaIds,
        pdfUrl: versao.pdfUrl,
        pdfTamanho: versao.pdfTamanho,
        enviadoPara: versao.enviadoPara,
        conteudo: dados.conteudo as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.linkAprovacao.updateMany({ where: { relatorioId: id, invalidadoEm: null }, data: { invalidadoEm: emitidoEm } });
    await tx.linkAprovacao.createMany({ data: links });
  });
  return { versao, links: links.map(paraLink) };
}

// ---------- Aprovação pelo link ----------

export interface AcessoPorLink {
  link: TokenAprovacao;
  relatorio: Relatorio;
  versao: VersaoRelatorio;
  /** Número da versão mais recente (se maior que a do link, este link é de versão anterior). */
  ultimaVersao: number;
  /** O link ainda permite decidir. */
  podeDecidir: boolean;
}

export async function buscarPorLink(token: string): Promise<AcessoPorLink | null> {
  const link = await reports.linkAprovacao.findUnique({ where: { token } });
  if (!link) return null;
  const relatorio = await buscarRelatorio(link.relatorioId);
  const versao = relatorio?.versoes.find((v) => v.numero === link.versao);
  if (!relatorio || !versao) return null;
  const ultimaVersao = relatorio.versoes.length;
  const podeDecidir = !link.invalidadoEm && link.versao === ultimaVersao && !versao.decisao && relatorio.status === "enviado";
  return { link: paraLink(link), relatorio, versao, ultimaVersao, podeDecidir };
}

/** Endereços de arquivos que fazem parte da versão (PDF, fotos, prints e assinaturas). */
export function arquivosDaVersao(v: VersaoRelatorio): Set<string> {
  const urls = new Set<string>();
  if (v.pdfUrl) urls.add(v.pdfUrl);
  for (const vis of v.conteudo?.visitas ?? []) {
    for (const f of [vis.fotoAmbiente, vis.printTela, ...vis.fotosExtras]) if (f) urls.add(f.url);
    for (const p of vis.presencas) if (p.assinatura) urls.add(p.assinatura);
  }
  return urls;
}

/**
 * Registra a decisão do aprovador. Vale a primeira: invalida os links de todos os aprovadores
 * desta versão. Aprovado → as visitas ficam travadas.
 */
export async function registrarDecisao(
  token: string,
  tipo: "aprovado" | "ajuste",
  motivo: string | null,
): Promise<{ ok: true; acesso: AcessoPorLink; outros: TokenAprovacao[] } | { ok: false; erro: string }> {
  const acesso = await buscarPorLink(token);
  if (!acesso) return { ok: false, erro: "Link inválido." };
  const jaDecidido = { ok: false as const, erro: "Este relatório já teve uma decisão ou foi substituído por uma versão mais nova." };
  if (!acesso.podeDecidir) return jaDecidido;

  const agora = new Date();
  const { link, relatorio, versao } = acesso;
  const decisao: DecisaoRelatorio = { tipo, aprovadorNome: link.aprovadorNome, aprovadorEmail: link.aprovadorEmail, motivo, em: agora.toISOString() };

  const valeu = await reports.$transaction(async (tx) => {
    // Dois aprovadores ao mesmo tempo: só o primeiro tira o relatório de "enviado".
    const { count } = await tx.relatorio.updateMany({
      where: { id: relatorio.id, status: "enviado" },
      data: { status: tipo === "aprovado" ? "aprovado" : "ajuste_solicitado", atualizadoEm: agora },
    });
    if (!count) return false;
    await tx.versaoRelatorio.updateMany({ where: { relatorioId: relatorio.id, numero: versao.numero }, data: { decisao: decisao as unknown as Prisma.InputJsonValue } });
    await tx.linkAprovacao.updateMany({ where: { relatorioId: relatorio.id, versao: versao.numero, invalidadoEm: null }, data: { invalidadoEm: agora } });
    return true;
  });
  if (!valeu) return jaDecidido;

  const daVersao = await reports.linkAprovacao.findMany({ where: { relatorioId: relatorio.id, versao: versao.numero, NOT: { token } } });
  return {
    ok: true,
    acesso: { ...acesso, relatorio: { ...relatorio, status: tipo === "aprovado" ? "aprovado" : "ajuste_solicitado" }, versao: { ...versao, decisao }, podeDecidir: false },
    outros: daVersao.map(paraLink),
  };
}
