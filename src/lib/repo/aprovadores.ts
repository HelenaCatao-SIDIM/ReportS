import "server-only";
import { reports } from "@/lib/db";
import { normalizar } from "@/lib/format";
import type { Aprovador } from "@/lib/types";

/*
 * Aprovadores — banco do ReportS. Cadastro próprio, independente dos participantes (D-07): a mesma pessoa pode
 * aprovar para vários contratos. Sem login.
 */

const SELECAO = { id: true, nome: true, cargo: true, email: true, ativo: true } as const;

const porNome = (a: Aprovador, b: Aprovador) => a.nome.localeCompare(b.nome, "pt-BR");

export async function listarAprovadores(opcoes: { busca?: string; incluirInativos?: boolean } = {}): Promise<Aprovador[]> {
  const b = normalizar(opcoes.busca ?? "");
  const todos = await reports.aprovador.findMany({ where: opcoes.incluirInativos ? undefined : { ativo: true }, select: SELECAO });
  return todos.filter((a) => !b || [a.nome, a.cargo, a.email].some((c) => normalizar(c).includes(b))).sort(porNome);
}

export async function buscarAprovador(id: string): Promise<Aprovador | null> {
  return reports.aprovador.findUnique({ where: { id }, select: SELECAO });
}

/** Na ordem dos ids informados (a ordem em que foram marcados no contrato). */
export async function buscarAprovadoresPorIds(ids: string[]): Promise<Aprovador[]> {
  if (!ids.length) return [];
  const achados = new Map((await reports.aprovador.findMany({ where: { id: { in: ids } }, select: SELECAO })).map((a) => [a.id, a]));
  return ids.map((id) => achados.get(id)).filter((a): a is Aprovador => !!a);
}

export async function buscarAprovadorPorEmail(email: string): Promise<Aprovador | null> {
  return reports.aprovador.findUnique({ where: { email: email.trim().toLowerCase() }, select: SELECAO });
}

export type DadosAprovador = Pick<Aprovador, "nome" | "cargo" | "email">;

export async function criarAprovador(d: DadosAprovador): Promise<Aprovador> {
  return reports.aprovador.create({ data: { ...d, email: d.email.trim().toLowerCase(), id: crypto.randomUUID() }, select: SELECAO });
}

export async function atualizarAprovador(id: string, d: DadosAprovador): Promise<void> {
  await reports.aprovador.updateMany({ where: { id }, data: { ...d, email: d.email.trim().toLowerCase() } });
}

export async function definirAprovadorAtivo(id: string, ativo: boolean): Promise<void> {
  await reports.aprovador.updateMany({ where: { id }, data: { ativo } });
}
