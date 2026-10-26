"use server";

import { revalidatePath } from "next/cache";
import { exigirGestorAcao } from "@/lib/dal";
import { atualizarTema, criarTema, definirTemaAtivo, grafiaCanonica, temaDuplicado } from "@/lib/repo/temas";

export interface TemaFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "sistema" | "modulo" | "geral", string>>;
  valores?: { nome: string; sistema: string; modulo: string };
}

/** Cria (temaId null) ou edita um tema. */
export async function salvarTema(temaId: string | null, _: TemaFormState, fd: FormData): Promise<TemaFormState> {
  await exigirGestorAcao();
  const d = {
    nome: String(fd.get("nome") ?? "").trim(),
    sistema: String(fd.get("sistema") ?? "").trim(),
    modulo: String(fd.get("modulo") ?? "").trim(),
  };

  const erros: NonNullable<TemaFormState["erros"]> = {};
  if (!d.nome) erros.nome = "Informe o nome do tema.";
  if (!d.sistema) erros.sistema = "Informe o sistema.";
  if (!d.modulo) erros.modulo = "Informe o módulo.";
  if (!Object.keys(erros).length && (await temaDuplicado(d, temaId ?? undefined))) {
    erros.geral = "Já existe um tema com este nome, sistema e módulo.";
  }
  if (Object.keys(erros).length) return { erros, valores: d };

  const final = await grafiaCanonica(d, temaId ?? undefined);
  if (temaId) await atualizarTema(temaId, final);
  else await criarTema(final);
  revalidatePath("/admin/temas");
  return { ok: true };
}

export async function alternarTema(id: string, ativo: boolean) {
  await exigirGestorAcao();
  await definirTemaAtivo(id, ativo);
  revalidatePath("/admin/temas");
}
