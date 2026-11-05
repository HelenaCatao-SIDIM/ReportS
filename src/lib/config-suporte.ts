import "server-only";

/*
 * Chamados de suporte no relatório (atendimentos do Fortics guardados no n8n): sempre ativos, não há como desligar.
 * A conexão com o n8n (endereço do webhook e chave) é guardada no banco e editada em Administração → Configurações.
 */

/** A chave viaja até o n8n: em produção só https://; fora dela, http:// também (para testar com um n8n de desenvolvimento). */
export function urlN8nPermitida(url: string, producao: boolean = process.env.NODE_ENV === "production"): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && !producao);
  } catch {
    return false;
  }
}
