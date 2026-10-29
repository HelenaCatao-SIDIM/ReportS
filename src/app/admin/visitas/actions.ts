"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { deInputLocal } from "@/lib/datas";
import { TIPOS_VISITA } from "@/lib/visitas";
import { buscarSetor, buscarUnidade } from "@/lib/repo/clientes";
import { listarTemas } from "@/lib/repo/temas";
import { buscarVisita, cancelarPelaAdministracao, corrigirPelaAdministracao, encerrarPelaAdministracao } from "@/lib/repo/visitas";
import type { TipoVisita } from "@/lib/types";

// ---------- Encerrar / cancelar (visita em andamento) ----------

export interface AcaoVisitaState {
  ok?: boolean;
  erros?: Partial<Record<"saida" | "justificativa" | "geral", string>>;
  valores?: { saida: string; justificativa: string };
}

export async function encerrarVisita(id: string, _: AcaoVisitaState, fd: FormData): Promise<AcaoVisitaState> {
  const autor = await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  const v = await buscarVisita(id);
  if (!v || v.status !== "em_andamento") return { erros: { geral: "Esta visita não está mais em andamento." } };

  const saidaTxt = String(fd.get("saida") ?? "");
  const justificativa = String(fd.get("justificativa") ?? "").trim();
  const saida = deInputLocal(saidaTxt);

  const erros: NonNullable<AcaoVisitaState["erros"]> = {};
  if (!saida) erros.saida = "Informe a data e a hora em que o técnico saiu.";
  else if (saida <= v.entrada) erros.saida = "A saída precisa ser depois da entrada.";
  else if (new Date(saida).getTime() > Date.now()) erros.saida = "A saída não pode estar no futuro.";
  if (justificativa.length < 5) erros.justificativa = "Explique por que a visita está sendo encerrada pela administração.";
  if (Object.keys(erros).length) return { erros, valores: { saida: saidaTxt, justificativa } };

  await encerrarPelaAdministracao(id, saida!, autor, justificativa);
  revalidatePath("/admin/visitas", "layout");
  return { ok: true };
}

export async function cancelarVisita(id: string, _: AcaoVisitaState, fd: FormData): Promise<AcaoVisitaState> {
  const autor = await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  const v = await buscarVisita(id);
  if (!v || v.status !== "em_andamento") return { erros: { geral: "Esta visita não está mais em andamento." } };

  const justificativa = String(fd.get("justificativa") ?? "").trim();
  if (justificativa.length < 5) {
    return { erros: { justificativa: "Explique por que o check-in está sendo cancelado." }, valores: { saida: "", justificativa } };
  }
  await cancelarPelaAdministracao(id, autor, justificativa);
  revalidatePath("/admin/visitas", "layout");
  return { ok: true };
}

// ---------- Corrigir (visita encerrada) ----------

export interface CorrecaoState {
  erros?: Partial<Record<"entrada" | "saida" | "unidade" | "setor" | "motivo" | "geral", string>>;
}

export async function corrigirVisita(id: string, _: CorrecaoState, fd: FormData): Promise<CorrecaoState> {
  const autor = await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  const v = await buscarVisita(id);
  if (!v || v.status !== "encerrada") return { erros: { geral: "Só visitas encerradas podem ser corrigidas." } };
  if (v.travada) return { erros: { geral: "Esta visita está em um relatório aprovado e não pode mais ser alterada." } };

  const entrada = deInputLocal(String(fd.get("entrada") ?? ""));
  const saida = deInputLocal(String(fd.get("saida") ?? ""));
  const tipo = String(fd.get("tipo") ?? "") as TipoVisita;
  const unidadeId = String(fd.get("unidadeId") ?? "");
  const setorValor = String(fd.get("setorId") ?? "");
  const setorOutro = String(fd.get("setorOutro") ?? "").trim();
  const motivo = String(fd.get("motivo") ?? "").trim();

  const erros: NonNullable<CorrecaoState["erros"]> = {};
  if (!entrada) erros.entrada = "Data e hora inválidas.";
  if (!saida) erros.saida = "Data e hora inválidas.";
  else if (entrada && saida <= entrada) erros.saida = "A saída precisa ser depois da entrada.";
  else if (new Date(saida).getTime() > Date.now()) erros.saida = "A saída não pode estar no futuro.";

  const unidade = await buscarUnidade(unidadeId);
  if (!unidade || unidade.clienteId !== v.clienteId) erros.unidade = "Escolha um estabelecimento do cliente.";
  let setorId: string | null = null;
  if (setorValor === "outro") {
    if (!setorOutro) erros.setor = "Informe o nome do setor.";
  } else {
    const setor = await buscarSetor(setorValor);
    if (!setor || setor.unidadeId !== unidadeId) erros.setor = "Escolha um setor do estabelecimento.";
    else setorId = setor.id;
  }
  if (motivo.length < 5) erros.motivo = "Informe o motivo da correção (fica no histórico).";
  if (Object.keys(erros).length) return { erros };

  // Só temas do sistema do contrato da visita (os que já estavam marcados continuam aceitos).
  const permitidos = new Set((await listarTemas()).filter((t) => t.sistema === v.sistema && (t.ativo || v.temaIds.includes(t.id))).map((t) => t.id));

  const mudancas = await corrigirPelaAdministracao(
    id,
    {
      entrada: entrada!,
      saida: saida!,
      tipo: TIPOS_VISITA.some((t) => t.valor === tipo) ? tipo : v.tipo,
      unidadeId,
      setorId,
      setorOutro: setorId ? null : setorOutro,
      temaIds: fd.getAll("temaIds").map(String).filter((id) => permitidos.has(id)),
      temaAdicional: String(fd.get("temaAdicional") ?? "").trim(),
      observacoes: String(fd.get("observacoes") ?? "").trim(),
      pendencias: String(fd.get("pendencias") ?? "").trim(),
      proximosPassos: String(fd.get("proximosPassos") ?? "").trim(),
      removerPresencas: fd.getAll("removerPresenca").map(String),
      removerFotos: fd.getAll("removerFoto").map(String),
    },
    autor,
    motivo,
  );
  if (!mudancas.length) return { erros: { geral: "Nenhuma alteração foi feita." } };

  revalidatePath("/admin/visitas", "layout");
  redirect(`/admin/visitas/${id}?ok=corrigida`);
}
