import type { ResumoSuporte } from "@/lib/types";

/**
 * Regra de emissão do relatório, compartilhada entre servidor e navegador (não acessa banco).
 *
 * O relatório sai com ou sem visitas: cliente que passou o mês sem visita recebe os chamados de suporte (e o cronograma). Sem
 * visitas, só não dá para emitir se os chamados não puderam ser consultados, porque o relatório sairia sem nada.
 */
export type PodeEmitir = { ok: true } | { ok: false; motivo: string };

export function conteudoParaEmitir(visitas: number, suporte: Pick<ResumoSuporte, "situacao" | "totalAbertosEFechados"> | null | undefined): PodeEmitir {
  if (visitas > 0 || suporte?.situacao === "ok") return { ok: true };
  switch (suporte?.situacao) {
    case "nao_configurado":
      return { ok: false, motivo: "O período não tem visitas e a conexão com o n8n ainda não foi configurada (Administração → Configurações), então não há chamados para mostrar." };
    case "sem_vinculo":
      return { ok: false, motivo: "O período não tem visitas e o cliente está sem “Nome no SINC” para buscar os chamados de suporte. Preencha o nome no cadastro do cliente." };
    default:
      return { ok: false, motivo: "O período não tem visitas e não foi possível consultar os chamados de suporte agora. Tente de novo em instantes." };
  }
}
