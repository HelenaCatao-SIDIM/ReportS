/** Regras de negócio da visita compartilhadas entre telas e servidor. */
import type { TipoVisita } from "@/lib/types";

/** Tipos em que o check-out exige ao menos um participante na lista. */
export const exigeParticipantes = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online";

/** Chave do rascunho do check-out guardado no aparelho. */
export const chaveRascunho = (visitaId: string) => `checkout-rascunho:${visitaId}`;

/** Rascunho do check-in (cliente, unidade, setor, tipo e link); a foto e a localização não são guardadas. */
export const chaveRascunhoCheckin = "checkin-rascunho";

/** Rascunho do cadastro de novo participante durante a visita; a assinatura não é guardada. */
export const chaveRascunhoParticipante = (visitaId: string) => `participante-rascunho:${visitaId}`;

/** Rascunho do campo "tema adicional" da visita. */
export const chaveRascunhoTema = (visitaId: string) => `tema-adicional-rascunho:${visitaId}`;
