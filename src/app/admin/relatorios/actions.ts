"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirGestorAcao } from "@/lib/dal";
import { buscarCliente } from "@/lib/repo/clientes";
import { atualizarVisitasDoRascunho, criarRascunho, excluirRascunho } from "@/lib/repo/relatorios";
import { emitirRelatorio } from "@/lib/emissao";

export interface NovoRelatorioState {
  erros?: Partial<Record<"cliente" | "de" | "ate" | "geral", string>>;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function criarRelatorio(_: NovoRelatorioState, fd: FormData): Promise<NovoRelatorioState> {
  await exigirGestorAcao();
  const clienteId = String(fd.get("clienteId") ?? "");
  const de = String(fd.get("de") ?? "");
  const ate = String(fd.get("ate") ?? "");

  const erros: NonNullable<NovoRelatorioState["erros"]> = {};
  if (!(await buscarCliente(clienteId))) erros.cliente = "Escolha o cliente.";
  if (!DATA.test(de)) erros.de = "Informe a data inicial.";
  if (!DATA.test(ate)) erros.ate = "Informe a data final.";
  else if (DATA.test(de) && ate < de) erros.ate = "A data final precisa ser depois da inicial.";
  if (Object.keys(erros).length) return { erros };

  const r = await criarRascunho(clienteId, de, ate);
  if ("erro" in r) return { erros: { geral: r.erro } };

  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/admin/relatorios/${r.relatorio.id}?ok=criado`);
}

export async function recalcularVisitas(id: string) {
  await exigirGestorAcao();
  const { antes, depois } = await atualizarVisitasDoRascunho(id);
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/admin/relatorios/${id}?ok=atualizado&antes=${antes}&depois=${depois}`);
}

export async function apagarRascunho(id: string) {
  await exigirGestorAcao();
  await excluirRascunho(id);
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect("/admin/relatorios?ok=excluido");
}

export async function emitir(id: string): Promise<string | null> {
  await exigirGestorAcao();
  const r = await emitirRelatorio(id);
  if ("erro" in r) return r.erro ?? "Não foi possível emitir.";
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/emails");
  redirect(`/admin/relatorios/${id}?ok=emitido&destinatarios=${r.destinatarios}&falhas=${r.falhas}`);
}
