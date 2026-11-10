"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { atualizarEquipe, buscarEquipe, criarEquipe, definirEquipeAtiva, equipeDuplicada } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";
import { buscarCbo, cbosExistentes } from "@/lib/repo/cbo";
import type { Cbo } from "@/lib/types";

export interface EquipeFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "temas" | "cbos", string>>;
  valores?: { nome: string; temaIds: string[]; cbos: Cbo[] };
}

/** Limite de ocupações por equipe: a ideia é ter só as que se enquadram, não uma família inteira da CBO. */
const MAX_CBOS = 60;

/** Cria (equipeId null) ou edita uma equipe e os seus temas mínimos. */
export async function salvarEquipe(equipeId: string | null, _: EquipeFormState, fd: FormData): Promise<EquipeFormState> {
  await exigirPermissaoAcao(PERMISSOES.temasGerenciar);
  const nome = String(fd.get("nome") ?? "").replace(/\s+/g, " ").trim();
  // Temas ativos, ou os que a equipe já tinha (um tema inativado depois continua aceito).
  const atuais = new Set(equipeId ? ((await buscarEquipe(equipeId))?.temaIds ?? []) : []);
  const validos = new Set((await listarTemas()).filter((t) => t.ativo || atuais.has(t.id)).map((t) => t.id));
  const temaIds = [...new Set(fd.getAll("temaIds").map(String))].filter((id) => validos.has(id));
  // Ocupações: opcionais; só as que existem na tabela CBO.
  const pedidos = [...new Set(fd.getAll("cbos").map((c) => String(c).replace(/\D/g, "")))].filter(Boolean);
  const existentes = await cbosExistentes(pedidos);
  const cboCodigos = pedidos.filter((c) => existentes.has(c));

  const erros: NonNullable<EquipeFormState["erros"]> = {};
  if (!nome) erros.nome = "Informe o nome da equipe.";
  else if (nome.length > 80) erros.nome = "Use até 80 caracteres.";
  else if (await equipeDuplicada(nome, equipeId ?? undefined)) erros.nome = "Já existe uma equipe com este nome.";
  if (!temaIds.length) erros.temas = "Escolha ao menos um tema mínimo.";
  if (cboCodigos.length < pedidos.length) erros.cbos = "Escolha apenas ocupações da tabela CBO.";
  else if (cboCodigos.length > MAX_CBOS) erros.cbos = `Escolha no máximo ${MAX_CBOS} ocupações.`;
  if (Object.keys(erros).length) {
    const cbos = (await Promise.all(cboCodigos.map(buscarCbo))).filter((c): c is Cbo => !!c);
    return { erros, valores: { nome, temaIds, cbos } };
  }

  if (equipeId) await atualizarEquipe(equipeId, { nome, temaIds, cboCodigos });
  else await criarEquipe({ nome, temaIds, cboCodigos });
  revalidatePath("/admin/equipes");
  return { ok: true };
}

export async function alternarEquipe(id: string, ativo: boolean) {
  await exigirPermissaoAcao(PERMISSOES.temasGerenciar);
  await definirEquipeAtiva(id, ativo);
  revalidatePath("/admin/equipes");
}
