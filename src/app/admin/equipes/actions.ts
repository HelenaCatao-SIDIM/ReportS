"use server";

import { revalidatePath } from "next/cache";
import { exigirGestorAcao } from "@/lib/dal";
import { atualizarEquipe, criarEquipe, definirEquipeAtiva, equipeDuplicada } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";

export interface EquipeFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "temas", string>>;
  valores?: { nome: string; temaIds: string[] };
}

const atualizar = () => {
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/participantes");
};

/** Cria (equipeId null) ou edita uma equipe e seus temas mínimos. */
export async function salvarEquipe(equipeId: string | null, _: EquipeFormState, fd: FormData): Promise<EquipeFormState> {
  await exigirGestorAcao();
  const nome = String(fd.get("nome") ?? "").trim();
  const existentes = new Set((await listarTemas()).map((t) => t.id));
  const temaIds = [...new Set(fd.getAll("temaIds").map(String))].filter((id) => existentes.has(id));

  const erros: NonNullable<EquipeFormState["erros"]> = {};
  if (!nome) erros.nome = "Informe o nome da equipe.";
  else if (await equipeDuplicada(nome, equipeId ?? undefined)) erros.nome = "Já existe uma equipe com este nome.";
  if (!temaIds.length) erros.temas = "Escolha ao menos um tema mínimo.";
  if (Object.keys(erros).length) return { erros, valores: { nome, temaIds } };

  if (equipeId) await atualizarEquipe(equipeId, { nome, temaIds });
  else await criarEquipe({ nome, temaIds });
  atualizar();
  return { ok: true };
}

export async function alternarEquipe(id: string, ativo: boolean) {
  await exigirGestorAcao();
  await definirEquipeAtiva(id, ativo);
  atualizar();
}
