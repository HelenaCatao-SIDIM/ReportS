"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import type { ResumoImportacao } from "@/lib/importacao-saude";
import { ErroSaude } from "@/lib/saude-api";
import { importarDoSaude } from "@/lib/repo/importacao-saude";

export type RespostaImportacao = { status: "ok"; resumo: ResumoImportacao } | { status: "erro"; mensagem: string };

/** Importa do SIDIM Saúde os estabelecimentos e os profissionais do sistema do cliente. Pode ser repetida: não duplica. */
export async function importarSaude(clienteId: string, sistemaDoClienteId: string): Promise<RespostaImportacao> {
  // Grava estabelecimentos e participantes: exige as duas permissões.
  const usuario = await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  if (!usuario.permissoes.includes(PERMISSOES.participantesGerenciar)) throw new Error("Acesso negado");

  try {
    const resumo = await importarDoSaude(String(sistemaDoClienteId), usuario.id);
    revalidatePath(`/admin/clientes/${clienteId}`);
    revalidatePath("/admin/participantes");
    return { status: "ok", resumo };
  } catch (e) {
    if (e instanceof ErroSaude) return { status: "erro", mensagem: e.message };
    console.error("Importação do Saúde", e);
    return { status: "erro", mensagem: "A importação falhou por um erro inesperado. Nada foi apagado; tente de novo." };
  }
}
