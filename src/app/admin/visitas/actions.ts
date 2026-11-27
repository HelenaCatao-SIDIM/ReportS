"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { deInputLocal } from "@/lib/datas";
import { TIPO_ONLINE, TIPOS_VISITA } from "@/lib/visitas";
import { equipesDaVisita, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { buscarUnidade } from "@/lib/repo/clientes";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";
import { buscarVisita, cancelarPelaAdministracao, corrigirPelaAdministracao, encerrarPelaAdministracao, excluirVisita } from "@/lib/repo/visitas";
import { registrarAuditoria } from "@/lib/repo/auditoria";
import { formatarData } from "@/lib/datas";

/** Rótulo da visita para a auditoria (cliente · técnico · data). */
const rotuloVisita = (v: { clienteNome: string; tecnicoNome: string; entrada: string }) =>
  `${v.clienteNome} · ${v.tecnicoNome} · ${formatarData(v.entrada)}`;

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
  await registrarAuditoria({
    autor, entidade: "visita", entidadeId: id, rotulo: rotuloVisita(v), acao: "encerrar",
    mudancas: [{ campo: "Motivo", antes: "—", depois: justificativa }],
  });
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
  await registrarAuditoria({
    autor, entidade: "visita", entidadeId: id, rotulo: rotuloVisita(v), acao: "cancelar",
    mudancas: [{ campo: "Motivo", antes: "—", depois: justificativa }],
  });
  revalidatePath("/admin/visitas", "layout");
  return { ok: true };
}

// ---------- Corrigir (visita encerrada) ----------

export interface CorrecaoState {
  erros?: Partial<Record<"entrada" | "saida" | "tipo" | "unidade" | "motivo" | "geral", string>>;
}

export async function corrigirVisita(id: string, _: CorrecaoState, fd: FormData): Promise<CorrecaoState> {
  const autor = await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  const v = await buscarVisita(id);
  if (!v || v.status !== "encerrada") return { erros: { geral: "Só visitas encerradas podem ser corrigidas." } };
  if (v.travada) return { erros: { geral: "Esta visita está em um relatório aprovado e não pode mais ser alterada." } };

  const entrada = deInputLocal(String(fd.get("entrada") ?? ""));
  const saida = deInputLocal(String(fd.get("saida") ?? ""));
  const marcados = fd.getAll("tipos").map(String);
  const tipos = TIPOS_VISITA.map((t) => t.valor).filter((t) => marcados.includes(t));
  const unidadeId = String(fd.get("unidadeId") ?? "");
  const motivo = String(fd.get("motivo") ?? "").trim();

  const erros: NonNullable<CorrecaoState["erros"]> = {};
  if (!entrada) erros.entrada = "Data e hora inválidas.";
  if (!saida) erros.saida = "Data e hora inválidas.";
  else if (entrada && saida <= entrada) erros.saida = "A saída precisa ser depois da entrada.";
  else if (new Date(saida).getTime() > Date.now()) erros.saida = "A saída não pode estar no futuro.";
  if (!tipos.length) erros.tipo = "Escolha ao menos um tipo de visita.";
  else if (tipos.includes(TIPO_ONLINE) && tipos.length > 1) erros.tipo = "“Treinamento online” não combina com os tipos presenciais.";

  const unidade = await buscarUnidade(unidadeId);
  if (!unidade || unidade.clienteId !== v.clienteId) erros.unidade = "Escolha um estabelecimento do cliente.";
  if (motivo.length < 5) erros.motivo = "Informe o motivo da correção (fica no histórico).";
  if (Object.keys(erros).length) return { erros };

  const [temas, equipes] = await Promise.all([listarTemas(), listarEquipes()]);
  // Só temas do sistema do contrato da visita (os que já estavam marcados continuam aceitos).
  const permitidos = new Set(temas.filter((t) => t.sistema === v.sistema && (t.ativo || v.temaIds.includes(t.id))).map((t) => t.id));
  // Equipes: só nos tipos que registram equipes, entre as que a visita aceita; com outro tipo, elas saem da visita.
  const equipesPermitidas = new Set(equipesDaVisita(equipes, v.equipeIds).map((e) => e.id));

  const mudancas = await corrigirPelaAdministracao(
    id,
    {
      entrada: entrada!,
      saida: saida!,
      tipos,
      unidadeId,
      equipeIds: sugereTemasPorEquipe(tipos) ? fd.getAll("equipeIds").map(String).filter((id) => equipesPermitidas.has(id)) : [],
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

  await registrarAuditoria({
    autor, entidade: "visita", entidadeId: id, rotulo: rotuloVisita(v), acao: "corrigir",
    mudancas: [{ campo: "Motivo", antes: "—", depois: motivo }, ...mudancas],
  });
  revalidatePath("/admin/visitas", "layout");
  redirect(`/admin/visitas/${id}?ok=corrigida`);
}

// ---------- Excluir (visita encerrada, fora de relatório) ----------

export interface ExclusaoState {
  erro?: string;
}

/** Exclui de vez uma visita encerrada que não está em relatório. Pede a palavra EXCLUIR digitada, porque não dá para desfazer. */
export async function excluirVisitaAcao(id: string, _: ExclusaoState, fd: FormData): Promise<ExclusaoState> {
  const autor = await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  if (String(fd.get("confirmar") ?? "").trim().toUpperCase() !== "EXCLUIR") return { erro: "Digite EXCLUIR para confirmar." };

  // Guarda o rótulo antes de apagar: depois a visita não existe mais para consultar.
  const v = await buscarVisita(id);
  const r = await excluirVisita(id);
  if (r === "nao_encontrada") return { erro: "Visita não encontrada (talvez já tenha sido excluída)." };
  if (r === "nao_encerrada") return { erro: "Só visitas encerradas podem ser excluídas." };
  if (r === "em_relatorio") return { erro: "Esta visita está em um relatório. Tire-a do relatório antes de excluir." };

  await registrarAuditoria({ autor, entidade: "visita", entidadeId: id, rotulo: v ? rotuloVisita(v) : "", acao: "excluir" });
  revalidatePath("/admin/visitas", "layout");
  redirect("/admin/visitas?aba=encerradas&ok=excluida");
}
