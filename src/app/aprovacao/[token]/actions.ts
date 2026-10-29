"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { enviarEmail } from "@/lib/email";
import { formatarDataCurta } from "@/lib/visitas";
import { buscarCliente } from "@/lib/repo/clientes";
import { registrarDecisao } from "@/lib/repo/relatorios";

/** Escapa texto digitado antes de entrar no HTML do e-mail. */
const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export interface DecisaoState {
  erro?: string;
  erroMotivo?: string;
}

async function decidir(token: string, tipo: "aprovado" | "ajuste", motivo: string | null): Promise<DecisaoState> {
  const r = await registrarDecisao(token, tipo, motivo);
  if (!r.ok) return { erro: r.erro };

  // Avisa os demais aprovadores do cliente (o gestor acompanha pelo status no sistema).
  const { link, relatorio, versao } = r.acesso;
  const cliente = await buscarCliente(relatorio.clienteId);
  const sistema = versao.conteudo?.sistema.nome ?? "";
  const periodo = `${formatarDataCurta(relatorio.de)} a ${formatarDataCurta(relatorio.ate)}`;
  for (const outro of r.outros) {
    await enviarEmail({
      para: { nome: outro.aprovadorNome, email: outro.aprovadorEmail },
      assunto:
        tipo === "aprovado"
          ? `Relatório SIDIM aprovado por ${link.aprovadorNome} — ${cliente?.nome} (${sistema}) — ${periodo}`
          : `Ajuste solicitado no relatório SIDIM — ${cliente?.nome} (${sistema}) — ${periodo}`,
      html:
        tipo === "aprovado"
          ? `<p>Olá, ${esc(outro.aprovadorNome)}.</p><p>O relatório de atendimento da SIDIM do sistema <b>${esc(sistema)}</b>, período de <b>${periodo}</b> (v${versao.numero}) foi <b>aprovado</b> por ${esc(link.aprovadorNome)}. Não é necessária nenhuma ação sua.</p>`
          : `<p>Olá, ${esc(outro.aprovadorNome)}.</p><p>${esc(link.aprovadorNome)} pediu um <b>ajuste</b> no relatório de atendimento da SIDIM do sistema <b>${esc(sistema)}</b>, período de <b>${periodo}</b> (v${versao.numero}):</p><p><i>“${esc(motivo ?? "")}”</i></p><p>A SIDIM fará a correção e enviará uma nova versão para aprovação.</p>`,
      anexos: [],
      botao: null,
      relatorioId: relatorio.id,
    });
  }

  revalidatePath(`/aprovacao/${token}`);
  revalidatePath("/admin/relatorios", "layout");
  revalidatePath("/admin/visitas", "layout");
  revalidatePath("/admin/emails");
  redirect(`/aprovacao/${token}?ok=${tipo}`);
}

export async function aprovar(token: string): Promise<DecisaoState> {
  return decidir(token, "aprovado", null);
}

export async function pedirAjuste(token: string, _: DecisaoState, fd: FormData): Promise<DecisaoState> {
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (motivo.length < 10) return { erroMotivo: "Descreva o que precisa ser ajustado (pelo menos 10 caracteres)." };
  return decidir(token, "ajuste", motivo.slice(0, 2000));
}
