"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { emailValido } from "@/lib/format";
import { atualizarAprovador, buscarAprovador, buscarAprovadorPorEmail, criarAprovador, definirAprovadorAtivo } from "@/lib/repo/aprovadores";
import { mudancasDe, registrarAuditoria } from "@/lib/repo/auditoria";

export interface AprovadorFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "email", string>>;
  valores?: { nome: string; cargo: string; email: string };
}

/** Cria (aprovadorId null) ou edita um aprovador. O e-mail é único no cadastro. */
export async function salvarAprovador(aprovadorId: string | null, _: AprovadorFormState, fd: FormData): Promise<AprovadorFormState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
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

  if (aprovadorId) {
    const antes = await buscarAprovador(aprovadorId);
    await atualizarAprovador(aprovadorId, d);
    await registrarAuditoria({
      autor: usuario, entidade: "aprovador", entidadeId: aprovadorId, rotulo: d.nome, acao: "editar",
      mudancas: mudancasDe([
        { campo: "Nome", antes: antes?.nome, depois: d.nome },
        { campo: "Cargo", antes: antes?.cargo, depois: d.cargo },
        { campo: "E-mail", antes: antes?.email, depois: d.email },
      ]),
    });
  } else {
    const a = await criarAprovador(d);
    await registrarAuditoria({
      autor: usuario, entidade: "aprovador", entidadeId: a.id, rotulo: d.nome, acao: "criar",
      mudancas: mudancasDe([
        { campo: "Nome", antes: undefined, depois: d.nome },
        { campo: "Cargo", antes: undefined, depois: d.cargo },
        { campo: "E-mail", antes: undefined, depois: d.email },
      ]),
    });
  }
  revalidatePath("/admin/aprovadores");
  revalidatePath("/admin/clientes", "layout");
  return { ok: true };
}

export async function alternarAprovador(id: string, ativo: boolean) {
  const usuario = await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  await definirAprovadorAtivo(id, ativo);
  await registrarAuditoria({ autor: usuario, entidade: "aprovador", entidadeId: id, rotulo: (await buscarAprovador(id))?.nome ?? "", acao: ativo ? "ativar" : "inativar" });
  revalidatePath("/admin/aprovadores");
  revalidatePath("/admin/clientes", "layout");
}
