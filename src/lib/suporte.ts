import "server-only";
import { connection } from "next/server";
import { lerConexaoN8n } from "@/lib/repo/configuracoes";
import type { ChamadoSuporte, Cliente, ContagemSuporte, ResumoSuporte } from "@/lib/types";

/*
 * Resumo dos chamados de suporte do cliente (abertos e fechados) no período, pedido ao fluxo
 * "Reports Sidim - Resumo de chamados por cliente" do n8n. Só o servidor chama, com a chave.
 * Nunca lança exceção: em qualquer falha devolve situacao "indisponivel" (o relatório segue sem os números).
 */

const TIMEOUT_MS = 8000;
const CACHE_MS = 10 * 60 * 1000;

const g = globalThis as unknown as { __suporte?: Map<string, { em: number; resumo: ResumoSuporte }> };
const cache = (g.__suporte ??= new Map<string, { em: number; resumo: ResumoSuporte }>());

/** Esquece os resumos guardados (depois de mudar a conexão com o n8n). */
export function limparCacheSuporte() {
  cache.clear();
}

function vazio(situacao: ResumoSuporte["situacao"]): ResumoSuporte {
  return { situacao, totalAbertosEFechados: 0, porSistema: [], porTopico: [], porMotivoEncerramento: [], tempoMedioEsperaMin: null, chamados: [], consultadoEm: new Date().toISOString() };
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const txt = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const naoNegativo = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;

function contagens(v: unknown): ContagemSuporte[] | null {
  if (!Array.isArray(v)) return null;
  const lista = v.filter(ehObjeto).map((x) => ({ nome: txt(x.nome), quantidade: x.quantidade }));
  return lista.every((x) => x.nome && naoNegativo(x.quantidade) && Number.isInteger(x.quantidade)) ? (lista as ContagemSuporte[]) : null;
}

/** Confere o formato da resposta do n8n. Devolve null se não for o esperado. */
export function lerResposta(json: unknown): Omit<ResumoSuporte, "situacao" | "consultadoEm"> | null {
  if (!ehObjeto(json)) return null;
  const total = json.totalAbertosEFechados;
  const porSistema = contagens(json.porSistema);
  const porTopico = contagens(json.porTopico);
  const porMotivoEncerramento = contagens(json.porMotivoEncerramento);
  const espera = json.tempoMedioEsperaMin;
  if (!naoNegativo(total) || !Number.isInteger(total) || !porSistema || !porTopico || !porMotivoEncerramento) return null;
  if (espera !== null && espera !== undefined && !naoNegativo(espera)) return null;
  if (json.chamados !== undefined && !Array.isArray(json.chamados)) return null;
  const chamados: ChamadoSuporte[] = (Array.isArray(json.chamados) ? json.chamados : []).filter(ehObjeto).map((c) => ({
    protocolo: txt(c.protocolo),
    abertura: txt(c.abertura),
    encerramento: txt(c.encerramento),
    sistema: txt(c.sistema),
    topico: txt(c.topico),
    motivoEncerramento: txt(c.motivoEncerramento),
    agente: txt(c.agente),
  }));
  return { totalAbertosEFechados: total as number, porSistema, porTopico, porMotivoEncerramento, tempoMedioEsperaMin: (espera as number | null | undefined) ?? null, chamados };
}

async function pedir(corpo: object, conexao: { url: string; chave: string }): Promise<Response> {
  return fetch(conexao.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": conexao.chave },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

/**
 * Chamados do cliente no período (datas AAAA-MM-DD, horário de Brasília, inclusive).
 * `sistema`: o "Nome no Fortics" do sistema do contrato, para contar só os chamados desse sistema; vazio = todos os sistemas do cliente.
 */
export async function buscarResumoSuporte(
  cliente: Pick<Cliente, "id" | "nomesFortics">,
  de: string,
  ate: string,
  sistema?: string | null,
): Promise<ResumoSuporte> {
  await connection(); // a hora da consulta e o cache dependem da requisição, nunca da pré-renderização
  const filtro = sistema?.trim() || null;
  const nomes = (cliente.nomesFortics ?? []).filter(Boolean);
  if (!nomes.length) return vazio("sem_vinculo");
  const conexao = await lerConexaoN8n();
  if (!conexao) return vazio("nao_configurado");

  const chave = JSON.stringify([nomes, de, ate, filtro]);
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.resumo;

  const corpo = { clientes: nomes, inicio: de, fim: ate, incluirLista: true, ...(filtro ? { sistema: filtro } : {}) };
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const r = await pedir(corpo, conexao);
      // Erro do servidor: tenta mais uma vez. Erro do pedido (4xx): não adianta repetir.
      if (r.status >= 500 && tentativa === 1) continue;
      if (!r.ok) {
        console.error(`[suporte] n8n respondeu ${r.status} para o cliente ${cliente.id}.`);
        return vazio("indisponivel");
      }
      const dados = lerResposta(await r.json());
      if (!dados) {
        console.error(`[suporte] resposta do n8n em formato inesperado (cliente ${cliente.id}).`);
        return vazio("indisponivel");
      }
      const resumo: ResumoSuporte = { situacao: "ok", ...dados, sistemaFiltro: filtro, consultadoEm: new Date().toISOString() };
      cache.set(chave, { em: Date.now(), resumo });
      return resumo;
    } catch (e) {
      // Rede ou tempo esgotado: tenta mais uma vez. A chave nunca vai para o log.
      if (tentativa === 2) console.error(`[suporte] falha ao consultar o n8n (cliente ${cliente.id}):`, e instanceof Error ? e.message : e);
    }
  }
  return vazio("indisponivel");
}

export type ResultadoTeste = { ok: true } | { ok: false; erro: string };

/** Testa a conexão com o n8n guardada (um pedido de um dia, sem lista, para um cliente que não existe). Nunca devolve nem registra a chave. */
export async function testarConexaoN8n(): Promise<ResultadoTeste> {
  const conexao = await lerConexaoN8n();
  if (!conexao) return { ok: false, erro: "Informe o endereço e a chave do n8n." };
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const r = await pedir({ clientes: ["Teste de conexão do ReportS"], inicio: hoje, fim: hoje, incluirLista: false }, conexao);
    if (r.status === 403 || r.status === 401) return { ok: false, erro: "O n8n recusou a chave. Confira se é a mesma da credencial “Chave Reports Sidim” do fluxo." };
    if (r.status === 404) return { ok: false, erro: "Endereço não encontrado no n8n. Confira a URL de produção do webhook e se o fluxo está ativo." };
    if (!r.ok) return { ok: false, erro: `O n8n respondeu com erro ${r.status}.` };
    if (!lerResposta(await r.json().catch(() => null))) return { ok: false, erro: "O n8n respondeu, mas num formato diferente do esperado. Confira se é o fluxo “Reports Sidim - Resumo de chamados por cliente”." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o n8n (fora do ar, endereço errado ou demorou demais)." };
  }
}
