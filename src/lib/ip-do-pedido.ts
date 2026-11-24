/**
 * IP de quem fez o pedido, para o log de requisições. Vem só do `X-Real-IP`, que o nginx grava com o endereço da conexão
 * (`$remote_addr`) e sobrescreve o que o navegador mandar. O `X-Forwarded-For` não serve: o nginx apenas ACRESCENTA o
 * endereço ao que já veio, então o primeiro item pode ser escrito por quem faz o pedido (mesma razão do limite de login,
 * `src/lib/limite-login.ts`). Sem o `X-Real-IP` (rodando sem nginx, em desenvolvimento) fica vazio, nunca um valor forjável.
 */
export function ipDoPedido(cabecalhos: Pick<Headers, "get">): string {
  return cabecalhos.get("x-real-ip")?.trim() ?? "";
}
