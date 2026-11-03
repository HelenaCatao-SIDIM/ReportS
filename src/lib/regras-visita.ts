/** Regras de negócio da visita compartilhadas entre telas e servidor. */
import type { Equipe, Tema, TipoVisita } from "@/lib/types";

/** Tipos em que o check-out exige ao menos um participante na lista. */
export const exigeParticipantes = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online";

/** Tipos em que o técnico marca as equipes treinadas e recebe os temas mínimos delas como sugestão. */
export const sugereTemasPorEquipe = (tipo: TipoVisita) => tipo === "implantacao" || tipo === "treinamento" || tipo === "treinamento_online";

/**
 * Equipes que podem ser marcadas na visita: as ativas com algum tema mínimo ativo do sistema do contrato, mais as que já
 * estavam marcadas (mesmo inativadas depois). Equipe só de outro sistema não aparece, para não ir ao relatório por engano.
 */
export function equipesDaVisita<E extends Pick<Equipe, "id" | "ativo" | "temaIds">>(
  equipes: E[],
  temas: Pick<Tema, "id" | "sistema" | "ativo">[],
  sistema: string,
  marcadas: string[],
): E[] {
  const doSistema = new Set(temas.filter((t) => t.sistema === sistema && t.ativo).map((t) => t.id));
  return equipes.filter((e) => marcadas.includes(e.id) || (e.ativo && e.temaIds.some((id) => doSistema.has(id))));
}

/** Chave do rascunho do check-out guardado no aparelho. */
export const chaveRascunho = (visitaId: string) => `checkout-rascunho:${visitaId}`;

/** Rascunho do check-in (cliente, estabelecimento, setor, tipo e link); a foto e a localização não são guardadas. */
export const chaveRascunhoCheckin = "checkin-rascunho";

/** Rascunho do cadastro de novo participante durante a visita; a assinatura não é guardada. */
export const chaveRascunhoParticipante = (visitaId: string) => `participante-rascunho:${visitaId}`;

/** Rascunho do campo "tema adicional" da visita. */
export const chaveRascunhoTema = (visitaId: string) => `tema-adicional-rascunho:${visitaId}`;
