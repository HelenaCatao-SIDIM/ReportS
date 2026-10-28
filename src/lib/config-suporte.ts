import "server-only";

/*
 * Chamados de suporte no relatório (dados do Fortics guardados no n8n). Lidos no servidor (.env.local).
 * Com CHAMADOS_SUPORTE desligado, o relatório fica como antes.
 */

const ligado = (nome: string) => process.env[nome] === "true";

export const chamadosSuporte = () => ligado("CHAMADOS_SUPORTE");

/** Bloco resumido de chamados também na capa do PDF. */
export const chamadosSuportePdf = () => chamadosSuporte() && ligado("CHAMADOS_SUPORTE_PDF");

export const n8nResumoUrl = () => process.env.N8N_RESUMO_CHAMADOS_URL ?? "";
export const n8nResumoChave = () => process.env.N8N_RESUMO_CHAMADOS_CHAVE ?? "";
