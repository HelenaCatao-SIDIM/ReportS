import type { ResumoSuporte } from "@/lib/types";

/**
 * Regra de emissão do relatório, compartilhada entre servidor e navegador (não acessa banco).
 *
 * Um relatório com visitas sempre pode ser emitido. Um relatório **sem visitas** (cliente que passou o mês sem visita) só pode
 * ser emitido se o período tem chamados de suporte: sem visita e sem chamado não há o que mostrar ao cliente.
 */
export type PodeEmitir = { ok: true } | { ok: false; motivo: string };

export function conteudoParaEmitir(visitas: number, suporte: Pick<ResumoSuporte, "situacao" | "totalAbertosEFechados"> | null | undefined): PodeEmitir {
  if (visitas > 0) return { ok: true };
  if (!suporte) return { ok: false, motivo: "O relatório não tem visitas. Sem visitas, só dá para emitir com os chamados de suporte ligados (CHAMADOS_SUPORTE)." };
  if (suporte.situacao === "ok" && suporte.totalAbertosEFechados > 0) return { ok: true };
  if (suporte.situacao === "indisponivel") return { ok: false, motivo: "O período não tem visitas e não foi possível consultar os chamados de suporte agora. Tente de novo em instantes." };
  if (suporte.situacao === "sem_vinculo") return { ok: false, motivo: "O período não tem visitas e o cliente está sem “Nome no SINC” para buscar os chamados de suporte. Preencha o nome no cadastro do cliente." };
  return { ok: false, motivo: "O período não tem visitas nem chamados de suporte." };
}
