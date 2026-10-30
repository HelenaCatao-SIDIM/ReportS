import "server-only";
import { normalizar } from "@/lib/format";
import type { Aprovador } from "@/lib/types";

/*
 * Repositório de aprovadores — implementação MOCK em memória.
 * Cadastro próprio, independente dos participantes (D-07): a mesma pessoa pode aprovar
 * para vários contratos. Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

function seed(): Aprovador[] {
  const a = (id: string, nome: string, cargo: string, email: string): Aprovador => ({ id, nome, cargo, email, ativo: true });
  return [
    a("a1", "Marta Ribeiro", "Secretária de Administração", "marta.ribeiro@valeverde.example"),
    a("a2", "José Antunes", "Diretor de TI", "jose.antunes@valeverde.example"),
    a("a3", "Renata Lopes", "Gerente administrativa", "renata@bemviver.example"),
    a("a4", "Paulo Mendes", "Secretário de Saúde", "paulo.mendes@valeverde.example"),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __aprovadores?: Aprovador[] };
const aprovadores = (g.__aprovadores ??= seed());

const porNome = (a: Aprovador, b: Aprovador) => a.nome.localeCompare(b.nome, "pt-BR");

export async function listarAprovadores(opcoes: { busca?: string; incluirInativos?: boolean } = {}): Promise<Aprovador[]> {
  const b = normalizar(opcoes.busca ?? "");
  return aprovadores
    .filter((a) => opcoes.incluirInativos || a.ativo)
    .filter((a) => !b || [a.nome, a.cargo, a.email].some((c) => normalizar(c).includes(b)))
    .sort(porNome);
}

export async function buscarAprovador(id: string): Promise<Aprovador | null> {
  return aprovadores.find((a) => a.id === id) ?? null;
}

/** Na ordem dos ids informados (a ordem em que foram marcados no contrato). */
export async function buscarAprovadoresPorIds(ids: string[]): Promise<Aprovador[]> {
  return ids.map((id) => aprovadores.find((a) => a.id === id)).filter((a): a is Aprovador => !!a);
}

export async function buscarAprovadorPorEmail(email: string): Promise<Aprovador | null> {
  const e = email.trim().toLowerCase();
  return aprovadores.find((a) => a.email === e) ?? null;
}

export type DadosAprovador = Pick<Aprovador, "nome" | "cargo" | "email">;

export async function criarAprovador(d: DadosAprovador): Promise<Aprovador> {
  const a: Aprovador = { ...d, email: d.email.trim().toLowerCase(), id: crypto.randomUUID(), ativo: true };
  aprovadores.push(a);
  return a;
}

export async function atualizarAprovador(id: string, d: DadosAprovador): Promise<void> {
  const a = aprovadores.find((x) => x.id === id);
  if (a) Object.assign(a, d, { email: d.email.trim().toLowerCase() });
}

export async function definirAprovadorAtivo(id: string, ativo: boolean): Promise<void> {
  const a = aprovadores.find((x) => x.id === id);
  if (a) a.ativo = ativo;
}
