"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { atualizarTema, buscarTemasPorIds, criarTema, definirTemaAtivo, grafiaCanonica, sistemaValido, temaDuplicado } from "@/lib/repo/temas";
import { mudancasDe, registrarAuditoria } from "@/lib/repo/auditoria";

export interface TemaFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "sistema" | "modulo" | "geral", string>>;
  valores?: { nome: string; sistema: string; modulo: string };
}

/** Cria (temaId null) ou edita um tema. */
export async function salvarTema(temaId: string | null, _: TemaFormState, fd: FormData): Promise<TemaFormState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.temasGerenciar);
  const d = {
    nome: String(fd.get("nome") ?? "").trim(),
    sistema: String(fd.get("sistema") ?? "").trim(),
    modulo: String(fd.get("modulo") ?? "").trim(),
  };

  const erros: NonNullable<TemaFormState["erros"]> = {};
  if (!d.nome) erros.nome = "Informe o nome do tema.";
  if (!d.sistema) erros.sistema = "Escolha o sistema.";
  else if (!(await sistemaValido(d.sistema, temaId ?? undefined))) erros.sistema = "Escolha um dos sistemas da lista.";
  if (!d.modulo) erros.modulo = "Informe o módulo.";
  if (!Object.keys(erros).length && (await temaDuplicado(d, temaId ?? undefined))) {
    erros.geral = "Já existe um tema com este nome, sistema e módulo.";
  }
  if (Object.keys(erros).length) return { erros, valores: d };

  const final = await grafiaCanonica(d, temaId ?? undefined);
  if (temaId) {
    const antes = (await buscarTemasPorIds([temaId]))[0];
    await atualizarTema(temaId, final);
    await registrarAuditoria({
      autor: usuario, entidade: "tema", entidadeId: temaId, rotulo: final.nome, acao: "editar",
      mudancas: mudancasDe([
        { campo: "Nome", antes: antes?.nome, depois: final.nome },
        { campo: "Sistema", antes: antes?.sistema, depois: final.sistema },
        { campo: "Módulo", antes: antes?.modulo, depois: final.modulo },
      ]),
    });
  } else {
    const t = await criarTema(final);
    await registrarAuditoria({
      autor: usuario, entidade: "tema", entidadeId: t.id, rotulo: final.nome, acao: "criar",
      mudancas: mudancasDe([
        { campo: "Nome", antes: undefined, depois: final.nome },
        { campo: "Sistema", antes: undefined, depois: final.sistema },
        { campo: "Módulo", antes: undefined, depois: final.modulo },
      ]),
    });
  }
  revalidatePath("/admin/temas");
  return { ok: true };
}

export async function alternarTema(id: string, ativo: boolean) {
  const usuario = await exigirPermissaoAcao(PERMISSOES.temasGerenciar);
  await definirTemaAtivo(id, ativo);
  await registrarAuditoria({ autor: usuario, entidade: "tema", entidadeId: id, rotulo: (await buscarTemasPorIds([id]))[0]?.nome ?? "", acao: ativo ? "ativar" : "inativar" });
  revalidatePath("/admin/temas");
}
