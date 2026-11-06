import type { ResumoSuporte, StatusRelatorio } from "@/lib/types";

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
      return { ok: false, motivo: "O período não tem visitas e o cliente está sem nome no cadastro para buscar os chamados de suporte." };
    default:
      return { ok: false, motivo: "O período não tem visitas e não foi possível consultar os chamados de suporte agora. Tente de novo em instantes." };
  }
}

/**
 * O relatório pode ser atualizado (visitas e chamados) e ganhar uma versão nova (v2, v3…) enquanto não foi aprovado.
 * Depois da aprovação ele fica travado, junto com as visitas.
 */
export const podeAtualizarRelatorio = (status: StatusRelatorio) => status !== "aprovado";

/** Enviar por e-mail: só uma versão já emitida e ainda não decidida (reenviar vale para a que já foi enviada). */
export const podeEnviarRelatorio = (status: StatusRelatorio) => status === "emitido" || status === "enviado";

