"use server";

import { exigirLogadoAcao } from "@/lib/dal";
import { pesquisarCbo as pesquisar } from "@/lib/repo/cbo";
import type { Cbo } from "@/lib/types";

/** Busca de ocupações (CBO) pelo nome da ocupação — usada na Administração e no App do Técnico. */
export async function pesquisarCbo(termo: string): Promise<Cbo[]> {
  await exigirLogadoAcao();
  return pesquisar(termo);
}
