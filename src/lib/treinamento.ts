import "server-only";
import type { Equipe, Participante, Tema } from "@/lib/types";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarParticipantes } from "@/lib/repo/participantes";
import { listarTemas } from "@/lib/repo/temas";
import { temasRecebidos } from "@/lib/repo/visitas";

/*
 * Treinamento por equipe: cada participante precisa receber os temas mínimos da sua equipe.
 * Recebeu = estava na lista de presença de uma visita com o tema marcado. Quem faltou continua pendente.
 */

export interface SituacaoTreinamento {
  participante: Participante;
  /** Null quando a pessoa não tem equipe ou a equipe foi inativada: nada é cobrado. */
  equipe: Equipe | null;
  /** Temas mínimos (ativos) da equipe que a pessoa ainda não recebeu. */
  pendentes: Tema[];
}

/** Situação de cada participante do cliente, por id. */
export async function situacaoTreinamento(clienteId: string): Promise<Map<string, SituacaoTreinamento>> {
  const [participantes, equipes, temas, recebidos] = await Promise.all([
    listarParticipantes(clienteId),
    listarEquipes(),
    listarTemas(),
    temasRecebidos(clienteId),
  ]);
  const ativos = new Map(temas.filter((t) => t.ativo).map((t) => [t.id, t]));
  return new Map(
    participantes.map((p) => {
      const equipe = equipes.find((e) => e.id === p.equipeId && e.ativo) ?? null;
      const ja = recebidos.get(p.id);
      const pendentes = (equipe?.temaIds ?? []).filter((id) => !ja?.has(id)).flatMap((id) => ativos.get(id) ?? []);
      return [p.id, { participante: p, equipe, pendentes }];
    }),
  );
}
