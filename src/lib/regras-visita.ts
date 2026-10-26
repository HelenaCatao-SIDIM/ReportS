/** Regras de negócio da visita compartilhadas entre telas e servidor. */
import type { TipoVisita } from "@/lib/types";

/** Tipos em que o check-out exige ao menos um participante na lista. */
export const exigeParticipantes = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online";

/** Chave do rascunho do check-out guardado no celular. */
export const chaveRascunho = (visitaId: string) => `checkout-rascunho:${visitaId}`;
