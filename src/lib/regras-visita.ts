/** Regras de negócio da visita compartilhadas entre telas e servidor. */
import { nomesParecidos } from "@/lib/similaridade";
import type { Equipe, Tema, TipoVisita } from "@/lib/types";

/** Tipos em que o check-out exige ao menos um participante na lista. */
export const exigeParticipantes = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online";

/**
 * Tipos em que, logo depois do check-in, o aparelho vai para a tela de presença (os participantes buscam o próprio nome e
 * assinam enquanto o técnico apresenta). Nos outros tipos, a visita abre direto na tela de temas e anotações.
 */
export const abrePelaPresenca = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online" || tipo === "implantacao";

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

/** Para onde o técnico vai ao abrir a visita em andamento: a presença, enquanto ninguém assinou; depois, a tela da visita. */
export const rotaDaVisita = (v: { id: string; tipo: TipoVisita; presencas: unknown[] }) =>
  abrePelaPresenca(v.tipo) && v.presencas.length === 0 ? `/tecnico/visita/${v.id}/presenca` : `/tecnico/visita/${v.id}`;

/**
 * O CPF digitado já é de alguém do cadastro. O nome do dono só aparece (para a pessoa tocar em "É esta pessoa") quando é
 * parecido com o de quem está assinando, isto é, provavelmente ela mesma. Senão a tela, que passa de mão em mão, estaria
 * revelando o nome de quem tem aquele CPF a quem digitou um número qualquer.
 */
export const podeMostrarDonoDoCpf = (nomeDeQuemAssina: string, nomeDoDono: string) => nomesParecidos(nomeDeQuemAssina, nomeDoDono);

/** Anotações da visita: escritas durante a visita (tela da visita) e completadas no check-out, que parte delas. */
export const CAMPOS_ANOTACAO = [
  { nome: "observacoes", rotulo: "Observações", dica: "O que foi feito na visita." },
  { nome: "pendencias", rotulo: "Pendências", dica: "O que ficou para resolver (do cliente ou da SIDIM)." },
  { nome: "proximosPassos", rotulo: "Próximos passos", dica: "O que foi combinado para a próxima etapa." },
] as const;

/** Chave do rascunho do check-out guardado no aparelho. */
export const chaveRascunho = (visitaId: string) => `checkout-rascunho:${visitaId}`;

/** Rascunho do check-in (cliente, estabelecimento, setor, tipo e link); a foto e a localização não são guardadas. */
export const chaveRascunhoCheckin = "checkin-rascunho";

/** Rascunho do cadastro de novo participante durante a visita; a assinatura não é guardada. */
export const chaveRascunhoParticipante = (visitaId: string) => `participante-rascunho:${visitaId}`;

/** Rascunho do campo "tema adicional" da visita. */
export const chaveRascunhoTema = (visitaId: string) => `tema-adicional-rascunho:${visitaId}`;
