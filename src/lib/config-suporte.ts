import "server-only";
import { normalizar } from "@/lib/format";

/*
 * Chamados de suporte no relatório (atendimentos do Fortics guardados no n8n): sempre ativos, não há como desligar.
 * A conexão com o n8n (o endereço do webhook, sem chave) é guardada no banco e editada em Administração → Configurações.
 */

/** O pedido leva nomes de clientes e traz chamados: em produção só https://; fora dela, http:// também (para testar com um n8n de desenvolvimento). */
export function urlN8nPermitida(url: string, producao: boolean = process.env.NODE_ENV === "production"): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && !producao);
  } catch {
    return false;
  }
}

/** O fluxo do n8n aceita de 1 a 10 nomes de até 120 caracteres. */
const MAX_NOMES = 10;
const MAX_TAMANHO_NOME = 120;

/**
 * Nomes pelos quais os chamados do cliente são buscados nos atendimentos do Fortics: o nome dele no SINC (já vem do cadastro, sem
 * digitar nada) mais os outros nomes que a Administração cadastrou, para quando o Fortics grava o cliente de outra forma. Sem repetir
 * (a comparação ignora acentos, maiúsculas e espaços extras, como no n8n).
 */
export function nomesDoCliente(cliente: { nome: string; nomesFortics?: string[] }): string[] {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const bruto of [cliente.nome, ...(cliente.nomesFortics ?? [])]) {
    const nome = (bruto ?? "").replace(/\s+/g, " ").trim();
    if (!nome || nome.length > MAX_TAMANHO_NOME || vistos.has(normalizar(nome))) continue;
    vistos.add(normalizar(nome));
    nomes.push(nome);
  }
  return nomes.slice(0, MAX_NOMES);
}
