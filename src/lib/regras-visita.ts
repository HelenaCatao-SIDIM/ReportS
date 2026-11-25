/** Regras de negócio da visita compartilhadas entre telas e servidor. */
import { nomesParecidos } from "@/lib/similaridade";
import { ehPresencial } from "@/lib/visitas";
import type { Equipe, NivelComprovacao, TipoVisita } from "@/lib/types";

/**
 * A presença pede assinatura: contrato "assinado", visita presencial e tipo que não seja a análise de ambiente (nela a presença
 * é só nominal, mesmo em contrato assinado). Treinamento online é sempre nominal.
 */
export const exigeAssinaturaNaPresenca = (nivel: NivelComprovacao | null | undefined, tipo: TipoVisita) =>
  nivel === "assinado" && ehPresencial(tipo) && tipo !== "analise_ambiente";

/**
 * A presença pede login do participante no Saúde: contrato "login", visita presencial e tipo que não seja a análise de
 * ambiente (nela a presença é só nominal). É alternativa à assinatura — o contrato marca uma só. Depende ainda de o sistema
 * do cliente ter login configurado (ver `configLoginDoSistema`); sem isso, não dá para exigir.
 */
export const exigeLoginNaPresenca = (nivel: NivelComprovacao | null | undefined, tipo: TipoVisita) =>
  nivel === "login" && ehPresencial(tipo) && tipo !== "analise_ambiente";

/** Tipos em que o check-out exige ao menos um participante na lista. */
export const exigeParticipantes = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online";

/** O técnico faz parte da visita (principal ou convidado) — numa visita conjunta, qualquer membro acessa e edita o que é comum. */
export const ehMembroDaVisita = (v: { tecnicoId: string; tecnicos?: { tecnicoId: string }[] }, tecnicoId: string) =>
  v.tecnicoId === tecnicoId || !!v.tecnicos?.some((t) => t.tecnicoId === tecnicoId);

/**
 * Tipos em que, logo depois do check-in, o aparelho vai para a tela de presença (os participantes buscam o próprio nome e
 * assinam enquanto o técnico apresenta). Nos outros tipos, a visita abre direto na tela de temas e anotações.
 */
export const abrePelaPresenca = (tipo: TipoVisita) => tipo === "treinamento" || tipo === "treinamento_online" || tipo === "implantacao";

/** Tipos em que o técnico marca as equipes treinadas e recebe os temas mínimos delas como sugestão. */
export const sugereTemasPorEquipe = (tipo: TipoVisita) => tipo === "implantacao" || tipo === "treinamento" || tipo === "treinamento_online";

/**
 * Equipes que podem ser marcadas no check-in e na visita: todas as ativas (com ou sem tema mínimo), mais as que já estavam
 * marcadas (mesmo inativadas depois). O tema mínimo só serve para sugerir temas na visita.
 */
export function equipesDaVisita<E extends Pick<Equipe, "id" | "ativo">>(equipes: E[], marcadas: string[]): E[] {
  return equipes.filter((e) => e.ativo || marcadas.includes(e.id));
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
// Rascunho das anotações/check-out: por visita **e por técnico** — numa visita conjunta, cada técnico tem as suas,
// e dois técnicos no mesmo navegador (um saiu, outro entrou) não misturam nem sobrescrevem o texto um do outro.
export const chaveRascunho = (visitaId: string, tecnicoId: string) => `checkout-rascunho:${visitaId}:${tecnicoId}`;

/** Rascunho do check-in (cliente, sistema, estabelecimento, equipes, tipo e link); a foto e a localização não são guardadas. */
export const chaveRascunhoCheckin = "checkin-rascunho";

/** Rascunho do cadastro de novo participante durante a visita; a assinatura não é guardada. */
export const chaveRascunhoParticipante = (visitaId: string) => `participante-rascunho:${visitaId}`;

/** Rascunho do campo "tema adicional" da visita. */
export const chaveRascunhoTema = (visitaId: string) => `tema-adicional-rascunho:${visitaId}`;
