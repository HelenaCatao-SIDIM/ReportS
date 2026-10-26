import "server-only";

/*
 * Envio de e-mail — implementação SIMULADA: guarda na caixa de saída (visível em /admin/emails).
 * Na fase de integração, só `enviarEmail` muda para chamar o provedor (Resend); quem chama não muda.
 */

export interface Anexo {
  nome: string;
  url: string;
  tamanho: number;
}

export interface EmailEnviado {
  id: string;
  para: { nome: string; email: string };
  assunto: string;
  /** Corpo em HTML simples. */
  html: string;
  anexos: Anexo[];
  /** Botão principal do e-mail (ex.: "Ver relatório"). */
  botao: { texto: string; url: string } | null;
  enviadoEm: string;
  relatorioId: string | null;
}

const g = globalThis as unknown as { __emails?: EmailEnviado[] };
const caixa = (g.__emails ??= []);

export async function enviarEmail(e: Omit<EmailEnviado, "id" | "enviadoEm">): Promise<EmailEnviado> {
  const enviado = { ...e, id: crypto.randomUUID(), enviadoEm: new Date().toISOString() };
  caixa.push(enviado);
  return enviado;
}

export async function listarEmails(): Promise<EmailEnviado[]> {
  return [...caixa].reverse();
}
