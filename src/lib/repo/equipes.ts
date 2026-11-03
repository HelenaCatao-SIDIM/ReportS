import "server-only";
import { normalizar } from "@/lib/format";
import type { Equipe } from "@/lib/types";

/*
 * Repositório de equipes — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

function seed(): Equipe[] {
  const e = (id: string, nome: string, temaIds: string[], ativo = true): Equipe => ({ id, nome, temaIds, ativo });
  return [
    e("e1", "Equipe médica", ["t10", "t11"]),
    e("e2", "Equipe de enfermagem", ["t10", "t12", "t13"]),
    e("e3", "Equipe de recepção", ["t7"]),
    e("e4", "Equipe de farmácia", ["t8", "t14"]),
    e("e5", "Equipe de faturamento", ["t15"]),
    e("e6", "Equipe administrativa", ["t1"]),
    e("e7", "Equipe de tributação", ["t1", "t2", "t3"]),
    e("e8", "Equipe de RH", ["t4", "t5", "t6"]),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __equipes?: Equipe[] };
const equipes = (g.__equipes ??= seed());

export async function listarEquipes(): Promise<Equipe[]> {
  return [...equipes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function buscarEquipe(id: string): Promise<Equipe | null> {
  return equipes.find((e) => e.id === id) ?? null;
}

export async function equipeDuplicada(nome: string, excetoId?: string) {
  const n = normalizar(nome);
  return equipes.some((e) => e.id !== excetoId && normalizar(e.nome) === n);
}

export type DadosEquipe = Pick<Equipe, "nome" | "temaIds">;

export async function criarEquipe(d: DadosEquipe): Promise<Equipe> {
  const e: Equipe = { ...d, id: crypto.randomUUID(), ativo: true };
  equipes.push(e);
  return e;
}

export async function atualizarEquipe(id: string, d: DadosEquipe): Promise<void> {
  const e = equipes.find((x) => x.id === id);
  if (e) Object.assign(e, d);
}

export async function definirEquipeAtiva(id: string, ativo: boolean): Promise<void> {
  const e = equipes.find((x) => x.id === id);
  if (e) e.ativo = ativo;
}
