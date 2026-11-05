import "server-only";
import { reports } from "@/lib/db";

/*
 * Configurações editadas na Administração (tabela `configuracoes`, chave → valor). Hoje só o endereço do webhook do n8n dos
 * chamados de suporte. Não há senha nem chave: o endereço é o único dado da conexão.
 */

const N8N_URL = "n8n.resumo_chamados.url";
/** Chave que uma versão anterior guardava (cifrada); não é mais usada e é apagada ao salvar. */
const N8N_CHAVE_ANTIGA = "n8n.resumo_chamados.chave";

/** Endereço do webhook do n8n, ou null se ainda não foi informado. */
export async function lerUrlN8n(): Promise<string | null> {
  return (await reports.configuracao.findUnique({ where: { chave: N8N_URL } }))?.valor ?? null;
}

export async function salvarUrlN8n(url: string) {
  await reports.$transaction([
    reports.configuracao.upsert({ where: { chave: N8N_URL }, create: { chave: N8N_URL, valor: url }, update: { valor: url } }),
    reports.configuracao.deleteMany({ where: { chave: N8N_CHAVE_ANTIGA } }),
  ]);
}
