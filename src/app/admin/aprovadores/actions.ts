"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { emailValido } from "@/lib/format";
import { atualizarAprovador, buscarAprovadorPorEmail, criarAprovador, definirAprovadorAtivo } from "@/lib/repo/aprovadores";

export interface AprovadorFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "email", string>>;
  valores?: { nome: string; cargo: string; email: string };
}

/** Cria (aprovadorId null) ou edita um aprovador. O e-mail é único no cadastro. */
export async function salvarAprovador(aprovadorId: string | null, _: AprovadorFormState, fd: FormData): Promise<AprovadorFormState> {
  await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const d = {
    nome: String(fd.get("nome") ?? "").trim(),
    cargo: String(fd.get("cargo") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
  };

  const erros: NonNullable<AprovadorFormState["erros"]> = {};
  if (!d.nome) erros.nome = "Informe o nome.";
  if (!emailValido(d.email)) erros.email = "E-mail inválido.";
  else {
    const outro = await buscarAprovadorPorEmail(d.email);
    if (outro && outro.id !== aprovadorId) erros.email = `Este e-mail já é de ${outro.nome}.`;
  }
  if (Object.keys(erros).length) return { erros, valores: d };

  if (aprovadorId) await atualizarAprovador(aprovadorId, d);
  else await criarAprovador(d);
  revalidatePath("/admin/aprovadores");
  revalidatePath("/admin/clientes", "layout");
  return { ok: true };
}

export async function alternarAprovador(id: string, ativo: boolean) {
  await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  await definirAprovadorAtivo(id, ativo);
  revalidatePath("/admin/aprovadores");
  revalidatePath("/admin/clientes", "layout");
}
