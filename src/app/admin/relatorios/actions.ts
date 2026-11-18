"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { buscarContrato } from "@/lib/repo/contratos";
import { atualizarVisitasDoRascunho, buscarRelatorio, criarRascunho, excluirRascunho } from "@/lib/repo/relatorios";
import { emitirRelatorio, enviarRelatorio } from "@/lib/emissao";
import { limparCacheSuporte } from "@/lib/suporte";
import { mudancasDe, registrarAuditoria } from "@/lib/repo/auditoria";

/** Rótulo curto do relatório (período) para a auditoria. */
const rotuloRel = async (id: string) => {
  const r = await buscarRelatorio(id);
  return r ? `${r.de} a ${r.ate}` : "";
};

export interface NovoRelatorioState {
  erros?: Partial<Record<"cliente" | "contrato" | "de" | "ate" | "geral", string>>;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function criarRelatorio(_: NovoRelatorioState, fd: FormData): Promise<NovoRelatorioState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.relatoriosGerenciar);
  const clienteId = String(fd.get("clienteId") ?? "");
  const contratoId = String(fd.get("contratoId") ?? "");
  const de = String(fd.get("de") ?? "");
  const ate = String(fd.get("ate") ?? "");

  const erros: NonNullable<NovoRelatorioState["erros"]> = {};
  // O relatório é de um contrato (cliente + sistema); o contrato precisa ser do cliente escolhido.
  const contrato = await buscarContrato(contratoId);
  if (!clienteId) erros.cliente = "Escolha o cliente.";
  else if (!contrato || contrato.clienteId !== clienteId) erros.contrato = "Escolha o sistema.";
  if (!DATA.test(de)) erros.de = "Informe a data inicial.";
  if (!DATA.test(ate)) erros.ate = "Informe a data final.";
  else if (DATA.test(de) && ate < de) erros.ate = "A data final precisa ser depois da inicial.";
  if (Object.keys(erros).length) return { erros };

  const r = await criarRascunho(contratoId, de, ate);
  if ("erro" in r) return { erros: { geral: r.erro } };

  await registrarAuditoria({ autor: usuario, entidade: "relatorio", entidadeId: r.relatorio.id, rotulo: `${de} a ${ate}`, acao: "criar" });
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/admin/relatorios/${r.relatorio.id}?ok=criado`);
}

export async function recalcularVisitas(id: string) {
  const usuario = await exigirPermissaoAcao(PERMISSOES.relatoriosGerenciar);
  const { antes, depois } = await atualizarVisitasDoRascunho(id);
  limparCacheSuporte(); // os chamados também são buscados de novo no n8n
  await registrarAuditoria({
    autor: usuario, entidade: "relatorio", entidadeId: id, rotulo: await rotuloRel(id), acao: "editar",
    mudancas: mudancasDe([{ campo: "Visitas no relatório", antes, depois }]),
  });
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect(`/admin/relatorios/${id}?ok=atualizado&antes=${antes}&depois=${depois}`);
}

export async function apagarRascunho(id: string) {
  const usuario = await exigirPermissaoAcao(PERMISSOES.relatoriosGerenciar);
  const rotulo = await rotuloRel(id);
  await excluirRascunho(id);
  await registrarAuditoria({ autor: usuario, entidade: "relatorio", entidadeId: id, rotulo, acao: "excluir" });
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  redirect("/admin/relatorios?ok=excluido");
}

/** Emite a próxima versão (PDF) sem enviar nada. Dá para emitir de novo (v2, v3…) até o relatório ser aprovado. */
export async function emitir(id: string): Promise<string | null> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.relatoriosGerenciar);
  const r = await emitirRelatorio(id);
  if ("erro" in r) return r.erro ?? "Não foi possível emitir.";
  await registrarAuditoria({
    autor: usuario, entidade: "relatorio", entidadeId: id, rotulo: await rotuloRel(id), acao: "emitir",
    mudancas: mudancasDe([{ campo: "Versão", antes: undefined, depois: r.versao }]),
  });
  revalidatePath("/admin/relatorios", "layout");
  redirect(`/admin/relatorios/${id}?ok=emitido&versao=${r.versao}`);
}

/** Envia por e-mail a última versão emitida aos aprovadores do contrato (também para reenviar). */
export async function enviar(id: string): Promise<string | null> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.relatoriosGerenciar);
  const r = await enviarRelatorio(id);
  if ("erro" in r) return r.erro ?? "Não foi possível enviar.";
  await registrarAuditoria({
    autor: usuario, entidade: "relatorio", entidadeId: id, rotulo: await rotuloRel(id), acao: "enviar",
    mudancas: mudancasDe([
      { campo: "Versão", antes: undefined, depois: r.versao },
      { campo: "Destinatários", antes: undefined, depois: r.destinatarios },
      { campo: "Falhas", antes: 0, depois: r.falhas },
    ]),
  });
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/emails");
  redirect(`/admin/relatorios/${id}?ok=enviado&versao=${r.versao}&destinatarios=${r.destinatarios}&falhas=${r.falhas}`);
}
