import "server-only";
import { fimDoDia, inicioDoDia } from "@/lib/datas";
import { ehPresencial } from "@/lib/visitas";
import type { Cliente, ConteudoCongelado, Relatorio, TokenAprovacao, VersaoRelatorio } from "@/lib/types";
import { buscarCliente } from "./clientes";
import { aprovadoresAtivosDoContrato, buscarContrato, listarContratos, type ContratoDetalhado } from "./contratos";
import { buscarVisitasDetalhadas, elegiveisParaRelatorio, vincularAoRelatorio, type VisitaDetalhada } from "./visitas";
import { relatorios, tokens } from "./relatorios-dados";

/*
 * Repositório de relatórios — implementação MOCK em memória.
 * Na fase de banco, só este arquivo (e relatorios-dados.ts) muda.
 */

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
  const contratos = await listarContratos();
  return relatorios
    .filter((r) => !f.clienteId || r.clienteId === f.clienteId)
    .filter((r) => !f.contratoId || r.contratoId === f.contratoId)
    .filter((r) => !f.de || r.ate >= f.de)
    .filter((r) => !f.ate || r.de <= f.ate)
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
    .map((r) => {
      const contrato = contratos.find((c) => c.id === r.contratoId);
      return { ...r, clienteNome: contrato?.clienteNome ?? "—", sistemaNome: contrato?.sistemaNome ?? "—", versaoAtual: r.versoes.length };
    });
}

export async function buscarRelatorio(id: string): Promise<Relatorio | null> {
  return relatorios.find((r) => r.id === id) ?? null;
}

/** Outro relatório do mesmo contrato cujo período cruza [de, ate]. */
export async function periodoSobreposto(contratoId: string, de: string, ate: string, excetoId?: string): Promise<Relatorio | null> {
  return relatorios.find((r) => r.contratoId === contratoId && r.id !== excetoId && r.de <= ate && r.ate >= de) ?? null;
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

  const agora = new Date().toISOString();
  const r: Relatorio = { id, clienteId: contrato.clienteId, contratoId, de, ate, status: "rascunho", visitaIds: ids, versoes: [], criadoEm: agora, atualizadoEm: agora };
  relatorios.push(r);
  await vincularAoRelatorio(id, ids);
  return { relatorio: r };
}

/** Recalcula as visitas do rascunho (ex.: uma visita esquecida foi encerrada depois). */
export async function atualizarVisitasDoRascunho(id: string): Promise<{ antes: number; depois: number }> {
  const r = relatorios.find((x) => x.id === id);
  if (!r || r.status === "aprovado" || r.status === "enviado") throw new Error("Só rascunhos (ou relatórios em ajuste) podem ser recalculados");
  const antes = r.visitaIds.length;
  r.visitaIds = await idsElegiveis(r);
  r.atualizadoEm = new Date().toISOString();
  await vincularAoRelatorio(r.id, r.visitaIds);
  return { antes, depois: r.visitaIds.length };
}

/** Exclui um rascunho que nunca foi emitido e libera as visitas. */
export async function excluirRascunho(id: string) {
  const i = relatorios.findIndex((x) => x.id === id);
  if (i < 0 || relatorios[i].status !== "rascunho" || relatorios[i].versoes.length) throw new Error("Só rascunhos nunca emitidos podem ser excluídos");
  await vincularAoRelatorio(id, []);
  relatorios.splice(i, 1);
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
  const [cliente, contrato] = await Promise.all([buscarCliente(relatorio.clienteId), buscarContrato(relatorio.contratoId)]);
  if (!cliente || !contrato) return null;
  const visitas = await buscarVisitasDetalhadas(relatorio.visitaIds);
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

/**
 * Registra a nova versão (v1, v2…), muda o status para "enviado", invalida os links da versão anterior
 * e cria um link por aprovador. Devolve a versão e os links criados.
 */
export async function registrarEmissao(
  id: string,
  dados: { conteudo: ConteudoCongelado; pdfUrl: string; pdfTamanho: number; emitidoEm: string },
): Promise<{ versao: VersaoRelatorio; links: TokenAprovacao[] }> {
  const r = relatorios.find((x) => x.id === id);
  if (!r || (r.status !== "rascunho" && r.status !== "ajuste_solicitado")) throw new Error("Este relatório não pode ser emitido agora");
  const aprovadores = await aprovadoresAtivosDoContrato(r.contratoId);
  if (!aprovadores.length) throw new Error("O contrato não tem aprovadores ativos");

  const numero = r.versoes.length + 1;
  const versao: VersaoRelatorio = {
    numero,
    emitidoEm: dados.emitidoEm,
    visitaIds: [...r.visitaIds],
    pdfUrl: dados.pdfUrl,
    pdfTamanho: dados.pdfTamanho,
    enviadoPara: aprovadores.map((a) => ({ nome: a.nome, email: a.email })),
    conteudo: dados.conteudo,
    decisao: null,
  };
  r.versoes.push(versao);
  r.status = "enviado";
  r.atualizadoEm = dados.emitidoEm;

  for (const t of tokens) if (t.relatorioId === id && !t.invalidadoEm) t.invalidadoEm = dados.emitidoEm;
  const links = aprovadores.map<TokenAprovacao>((a) => ({
    token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
    relatorioId: id,
    versao: numero,
    aprovadorNome: a.nome,
    aprovadorCargo: a.cargo,
    aprovadorEmail: a.email,
    criadoEm: dados.emitidoEm,
    invalidadoEm: null,
  }));
  tokens.push(...links);
  return { versao, links };
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
  const link = tokens.find((t) => t.token === token);
  if (!link) return null;
  const relatorio = relatorios.find((r) => r.id === link.relatorioId);
  const versao = relatorio?.versoes.find((v) => v.numero === link.versao);
  if (!relatorio || !versao) return null;
  const ultimaVersao = relatorio.versoes.length;
  const podeDecidir = !link.invalidadoEm && link.versao === ultimaVersao && !versao.decisao && relatorio.status === "enviado";
  return { link, relatorio, versao, ultimaVersao, podeDecidir };
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
  if (!acesso.podeDecidir) return { ok: false, erro: "Este relatório já teve uma decisão ou foi substituído por uma versão mais nova." };

  const agora = new Date().toISOString();
  const { link, relatorio, versao } = acesso;
  versao.decisao = { tipo, aprovadorNome: link.aprovadorNome, aprovadorEmail: link.aprovadorEmail, motivo, em: agora };
  relatorio.status = tipo === "aprovado" ? "aprovado" : "ajuste_solicitado";
  relatorio.atualizadoEm = agora;

  const daVersao = tokens.filter((t) => t.relatorioId === relatorio.id && t.versao === versao.numero);
  for (const t of daVersao) t.invalidadoEm ??= agora;
  return { ok: true, acesso: { ...acesso, podeDecidir: false }, outros: daVersao.filter((t) => t.token !== token) };
}
