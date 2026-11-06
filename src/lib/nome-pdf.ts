import type { TipoRelatorioAtendimentos } from "@/lib/types";

/*
 * Nome do relatório e do arquivo PDF: "Relatório Analítico - Prefeitura de Vale Verde - SCA - 01-10-2026 a 31-10-2026 - v1".
 * Tem o tipo (sintético ou analítico), o cliente, o sistema, o período de vigência e a versão. Compartilhado entre o servidor
 * (PDF, e-mail e downloads) e o navegador.
 */

export interface DadosNomeRelatorio {
  tipo?: TipoRelatorioAtendimentos;
  cliente: string;
  sistema: string;
  /** AAAA-MM-DD */
  de: string;
  ate: string;
  versao?: number | null;
  /** Prévia: ainda não é uma versão emitida. */
  previa?: boolean;
}

const dataNome = (d: string) => d.split("-").reverse().join("-");
// Caracteres que não podem estar em nome de arquivo (Windows, macOS e Linux) e controles.
const limpar = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim();

export function nomeDoRelatorio(d: DadosNomeRelatorio): string {
  const partes = [
    `${d.previa ? "PRÉVIA - " : ""}Relatório ${d.tipo === "analitico" ? "Analítico" : "Sintético"}`,
    limpar(d.cliente),
    limpar(d.sistema),
    `${dataNome(d.de)} a ${dataNome(d.ate)}`,
  ];
  if (d.versao) partes.push(`v${d.versao}`);
  return partes.filter(Boolean).join(" - ");
}

/** Nome do arquivo com a extensão, sem passar de 150 caracteres. */
export function nomeDoArquivoPdf(d: DadosNomeRelatorio): string {
  const nome = nomeDoRelatorio(d);
  return `${nome.length > 150 ? nome.slice(0, 150).trim() : nome}.pdf`;
}

/** Cabeçalho Content-Disposition de download: nome só com ASCII para os navegadores antigos e o nome completo em UTF-8. */
export function cabecalhoDeDownload(nome: string, tipo: "attachment" | "inline" = "attachment"): string {
  const ascii = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "'");
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
