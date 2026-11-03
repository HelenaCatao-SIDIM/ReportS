import "server-only";
import { reports } from "@/lib/db";
import { normalizar } from "@/lib/format";
import type { Equipe } from "@/lib/types";

/*
 * Equipes — banco do ReportS. Cadastro único da SIDIM (vale para todos os clientes), cada uma com os seus temas mínimos.
 * Não há exclusão: a equipe é inativada e continua nas visitas em que já foi marcada.
 */

const SELECAO = { id: true, nome: true, ativo: true, temas: { select: { temaId: true } } } as const;

const paraEquipe = (e: { id: string; nome: string; ativo: boolean; temas: { temaId: string }[] }): Equipe => ({
  id: e.id,
  nome: e.nome,
  ativo: e.ativo,
  temaIds: e.temas.map((t) => t.temaId),
});

const porNome = (a: Equipe, b: Equipe) => a.nome.localeCompare(b.nome, "pt-BR");

export async function listarEquipes(): Promise<Equipe[]> {
  return (await reports.equipe.findMany({ select: SELECAO })).map(paraEquipe).sort(porNome);
}

export async function buscarEquipe(id: string): Promise<Equipe | null> {
  const e = await reports.equipe.findUnique({ where: { id }, select: SELECAO });
  return e ? paraEquipe(e) : null;
}

/** Nomes das equipes pelos ids (para as visitas), numa consulta só. */
export async function nomesDasEquipes(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const linhas = await reports.equipe.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
  return new Map(linhas.map((e) => [e.id, e.nome]));
}

/** Nome repetido, sem diferenciar acento nem maiúsculas. */
export async function equipeDuplicada(nome: string, excetoId?: string) {
  const n = normalizar(nome);
  const todas = await reports.equipe.findMany({ select: { id: true, nome: true } });
  return todas.some((e) => e.id !== excetoId && normalizar(e.nome) === n);
}

export type DadosEquipe = Pick<Equipe, "nome" | "temaIds">;

export async function criarEquipe(d: DadosEquipe): Promise<Equipe> {
  const e = await reports.equipe.create({
    data: { id: crypto.randomUUID(), nome: d.nome, temas: { create: [...new Set(d.temaIds)].map((temaId) => ({ temaId })) } },
    select: SELECAO,
  });
  return paraEquipe(e);
}

export async function atualizarEquipe(id: string, d: DadosEquipe): Promise<void> {
  await reports.$transaction([
    reports.equipe.update({ where: { id }, data: { nome: d.nome } }),
    reports.equipeTema.deleteMany({ where: { equipeId: id } }),
    reports.equipeTema.createMany({ data: [...new Set(d.temaIds)].map((temaId) => ({ equipeId: id, temaId })) }),
  ]);
}

export async function definirEquipeAtiva(id: string, ativo: boolean): Promise<void> {
  await reports.equipe.updateMany({ where: { id }, data: { ativo } });
}
