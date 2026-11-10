import "server-only";
import { reports } from "@/lib/db";
import { normalizar } from "@/lib/format";
import type { Cbo } from "@/lib/types";

/*
 * Tabela CBO (Classificação Brasileira de Ocupações, Ministério do Trabalho), no banco do ReportS.
 * Carregada por `npm run cbo:importar` a partir do arquivo oficial (scripts/importar-cbo.ts).
 * São cerca de 2.600 ocupações: a lista fica em memória no processo e a busca é feita aqui, sem acento.
 */

let cache: { em: number; lista: (Cbo & { busca: string })[] } | null = null;
const VALIDADE_MS = 10 * 60 * 1000;

async function tabela() {
  if (!cache || Date.now() - cache.em > VALIDADE_MS) {
    const linhas = await reports.cbo.findMany({ orderBy: { titulo: "asc" } });
    cache = { em: Date.now(), lista: linhas.map((c) => ({ ...c, busca: normalizar(c.titulo) })) };
  }
  return cache.lista;
}

/** Busca ocupações pelo título (sem acento) ou pelo código. Retorna no máximo `limite` itens. */
export async function pesquisarCbo(termo: string, limite = 20): Promise<Cbo[]> {
  const t = normalizar(termo);
  if (t.length < 2) return [];
  const digitos = termo.replace(/\D/g, "");
  const palavras = t.split(/\s+/);
  return (await tabela())
    .filter((c) => (digitos.length >= 3 && c.codigo.startsWith(digitos)) || palavras.every((p) => c.busca.includes(p)))
    .slice(0, limite)
    .map(({ codigo, titulo }) => ({ codigo, titulo }));
}

export async function buscarCbo(codigo: string): Promise<Cbo | null> {
  if (!/^\d{6}$/.test(codigo)) return null;
  return reports.cbo.findUnique({ where: { codigo } });
}

/** Dos códigos informados, os que existem na tabela. */
export async function cbosExistentes(codigos: string[]): Promise<Set<string>> {
  const validos = codigos.filter((c) => /^\d{6}$/.test(c));
  if (!validos.length) return new Set();
  const linhas = await reports.cbo.findMany({ where: { codigo: { in: validos } }, select: { codigo: true } });
  return new Set(linhas.map((l) => l.codigo));
}
