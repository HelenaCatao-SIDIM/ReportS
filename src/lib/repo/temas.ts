import "server-only";
import { normalizar } from "@/lib/format";
import type { Tema } from "@/lib/types";

/*
 * Repositório de temas — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

function seed(): Tema[] {
  const t = (id: string, nome: string, sistema: string, modulo: string, ativo = true): Tema => ({ id, nome, sistema, modulo, ativo });
  return [
    t("t1", "Cadastro de contribuintes", "Gestão Tributária", "Cadastros"),
    t("t2", "Emissão de guias de IPTU", "Gestão Tributária", "Arrecadação"),
    t("t3", "Baixa de pagamentos", "Gestão Tributária", "Arrecadação"),
    t("t4", "Folha de pagamento mensal", "Gestão de Pessoas", "Folha"),
    t("t5", "Cálculo de férias", "Gestão de Pessoas", "Folha"),
    t("t6", "Ponto eletrônico", "Gestão de Pessoas", "Frequência"),
    t("t7", "Agendamento de consultas", "Saúde", "Recepção"),
    t("t8", "Dispensação de medicamentos", "Saúde", "Farmácia"),
    t("t9", "Relatórios gerenciais (versão antiga)", "Saúde", "Relatórios", false),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __temas?: Tema[] };
const temas = (g.__temas ??= seed());

const ordenar = (a: Tema, b: Tema) =>
  a.sistema.localeCompare(b.sistema, "pt-BR") || a.modulo.localeCompare(b.modulo, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");

/** Busca em nome, sistema e módulo (sem acento). */
export async function listarTemas(filtro: { busca?: string; sistema?: string } = {}): Promise<Tema[]> {
  const b = normalizar(filtro.busca ?? "");
  return temas
    .filter((t) => !filtro.sistema || t.sistema === filtro.sistema)
    .filter((t) => !b || [t.nome, t.sistema, t.modulo].some((c) => normalizar(c).includes(b)))
    .sort(ordenar);
}

/** Valores distintos já usados, para sugestão nos campos. */
export async function sugestoes(): Promise<{ sistemas: string[]; modulos: string[] }> {
  const unicos = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { sistemas: unicos(temas.map((t) => t.sistema)), modulos: unicos(temas.map((t) => t.modulo)) };
}

export async function temaDuplicado(d: Pick<Tema, "nome" | "sistema" | "modulo">, excetoId?: string) {
  const chave = (t: Pick<Tema, "nome" | "sistema" | "modulo">) => [t.nome, t.sistema, t.modulo].map(normalizar).join("|");
  return temas.some((t) => t.id !== excetoId && chave(t) === chave(d));
}

export type DadosTema = Pick<Tema, "nome" | "sistema" | "modulo">;

/** Reaproveita a grafia já cadastrada quando o valor só difere em acento/caixa ("gestao de pessoas" → "Gestão de Pessoas"). */
export async function grafiaCanonica(d: DadosTema, excetoId?: string): Promise<DadosTema> {
  const outros = temas.filter((t) => t.id !== excetoId);
  const achar = (valor: string, campo: "sistema" | "modulo") =>
    outros.find((t) => normalizar(t[campo]) === normalizar(valor))?.[campo] ?? valor;
  return { ...d, sistema: achar(d.sistema, "sistema"), modulo: achar(d.modulo, "modulo") };
}

export async function criarTema(d: DadosTema): Promise<Tema> {
  const t: Tema = { ...d, id: crypto.randomUUID(), ativo: true };
  temas.push(t);
  return t;
}

export async function atualizarTema(id: string, d: DadosTema): Promise<void> {
  const t = temas.find((x) => x.id === id);
  if (t) Object.assign(t, d);
}

export async function definirTemaAtivo(id: string, ativo: boolean): Promise<void> {
  const t = temas.find((x) => x.id === id);
  if (t) t.ativo = ativo;
}
