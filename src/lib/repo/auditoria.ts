import "server-only";
import { Prisma } from "@/generated/reports/client";
import { idPlataforma, reports } from "@/lib/db";
import type { AcaoAuditoria, EntidadeAuditoria, MudancaCampo, RegistroAuditoria } from "@/lib/types";

/*
 * Log central de auditoria. Toda Server Action que altera algo chama `registrarAuditoria` com quem fez (vem do
 * `exigirPermissaoAcao`), o que mudou e os campos antes → depois. É só gravação e leitura; nada edita o log.
 */

/** Teto de linhas lidas (as mais recentes); a tela avisa quando bate o teto. */
export const LIMITE_AUDITORIA = 500;

/** Valor legível de um campo para o antes/depois (nulo/vazio vira "—", booleano vira Sim/Não, lista junta com vírgula). */
function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.length ? v.map(valor).join(", ") : "—";
  return String(v);
}

/** Monta a lista de mudanças a partir de pares campo/antes/depois, deixando só os que de fato mudaram. */
export function mudancasDe(itens: { campo: string; antes: unknown; depois: unknown }[]): MudancaCampo[] {
  return itens
    .map((i) => ({ campo: i.campo, antes: valor(i.antes), depois: valor(i.depois) }))
    .filter((m) => m.antes !== m.depois);
}

export interface EntradaAuditoria {
  /** Quem fez (do `exigirPermissaoAcao`): precisa de id e nome. */
  autor: { id: string; nome: string };
  entidade: EntidadeAuditoria;
  entidadeId?: string;
  /** Nome legível da entidade no momento (ex.: nome do cliente). */
  rotulo?: string;
  acao: AcaoAuditoria;
  mudancas?: MudancaCampo[];
}

/**
 * Grava uma linha no log. Não derruba a ação se falhar: auditoria é registro, não pode impedir o trabalho.
 * Chame depois que a alteração deu certo.
 */
export async function registrarAuditoria(e: EntradaAuditoria): Promise<void> {
  try {
    await reports.auditoria.create({
      data: {
        id: crypto.randomUUID(),
        em: new Date(),
        autorId: idPlataforma(e.autor.id) ?? BigInt(0),
        autorNome: e.autor.nome,
        entidade: e.entidade,
        entidadeId: e.entidadeId ?? "",
        rotulo: e.rotulo ?? "",
        acao: e.acao,
        mudancas: (e.mudancas ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Só registra no servidor; a ação do usuário segue valendo.
    console.error("[auditoria] falha ao registrar", e.entidade, e.acao, e.entidadeId, err);
  }
}

export interface FiltroAuditoria {
  entidade?: EntidadeAuditoria;
  /** Busca no nome de quem fez ou no rótulo da entidade (sem diferenciar maiúsculas). */
  texto?: string;
  /** ISO inclusive. */
  de?: string;
  ate?: string;
}

/** Todas as alterações do sistema, da mais recente para a mais antiga. */
export async function listarAuditoria(f: FiltroAuditoria = {}): Promise<RegistroAuditoria[]> {
  const texto = f.texto?.trim();
  const linhas = await reports.auditoria.findMany({
    where: {
      ...(f.entidade ? { entidade: f.entidade } : {}),
      ...(f.de || f.ate ? { em: { ...(f.de ? { gte: new Date(f.de) } : {}), ...(f.ate ? { lte: new Date(f.ate) } : {}) } } : {}),
      ...(texto
        ? { OR: [{ autorNome: { contains: texto, mode: "insensitive" } }, { rotulo: { contains: texto, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { em: "desc" },
    take: LIMITE_AUDITORIA,
  });
  return linhas.map((l) => ({
    id: l.id,
    em: l.em.toISOString(),
    autorNome: l.autorNome,
    entidade: l.entidade as EntidadeAuditoria,
    entidadeId: l.entidadeId,
    rotulo: l.rotulo,
    acao: l.acao as AcaoAuditoria,
    mudancas: l.mudancas as unknown as MudancaCampo[],
  }));
}
