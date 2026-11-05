import "server-only";
import { reports } from "@/lib/db";
import { cifrar, decifrar } from "@/lib/segredo";

/*
 * Configurações editadas na Administração (tabela `configuracoes`, chave → valor). Hoje só a conexão com o n8n dos chamados de
 * suporte: o endereço do webhook e a chave. A chave fica cifrada no banco (`segredo.ts`) e nunca volta para a tela.
 */

const N8N_URL = "n8n.resumo_chamados.url";
const N8N_CHAVE = "n8n.resumo_chamados.chave";

const ler = async (chave: string) => (await reports.configuracao.findUnique({ where: { chave } }))?.valor ?? null;
const gravar = (chave: string, valor: string) => reports.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });

/** Endereço e chave para chamar o n8n, ou null se a conexão não está configurada (ou a chave não abre mais). */
export async function lerConexaoN8n(): Promise<{ url: string; chave: string } | null> {
  const [url, cifrada] = await Promise.all([ler(N8N_URL), ler(N8N_CHAVE)]);
  const chave = cifrada ? decifrar(cifrada) : null;
  return url && chave ? { url, chave } : null;
}

/** O que a tela pode mostrar: o endereço e se há chave guardada (a chave em si nunca sai). */
export async function situacaoConexaoN8n(): Promise<{ url: string; temChave: boolean; chaveIlegivel: boolean }> {
  const [url, cifrada] = await Promise.all([ler(N8N_URL), ler(N8N_CHAVE)]);
  const temChave = !!cifrada && decifrar(cifrada) !== null;
  return { url: url ?? "", temChave, chaveIlegivel: !!cifrada && !temChave };
}

/** Grava o endereço e, se informada, a chave (chave null = manter a que já está guardada). */
export async function salvarConexaoN8n(url: string, chave: string | null) {
  await gravar(N8N_URL, url);
  if (chave) await gravar(N8N_CHAVE, cifrar(chave));
}
