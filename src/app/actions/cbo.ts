"use server";

import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { pesquisarCbo as pesquisar } from "@/lib/repo/cbo";
import type { Cbo } from "@/lib/types";

/** Busca de ocupações (CBO) pelo nome da ocupação — usada na Administração (participantes e equipes) e no App do Técnico. */
export async function pesquisarCbo(termo: string): Promise<Cbo[]> {
  await exigirPermissaoAcao(PERMISSOES.participantesGerenciar, PERMISSOES.temasGerenciar, PERMISSOES.tecnico);
  return pesquisar(termo);
}
