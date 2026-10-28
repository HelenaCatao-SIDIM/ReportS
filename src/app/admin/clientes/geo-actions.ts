"use server";

import { exigirGestorAcao } from "@/lib/dal";
import { buscaCoordenadas } from "@/lib/config";
import { coordenadasDoEndereco, type ResultadoBusca } from "@/lib/geocodificar";

export type RespostaBusca = ResultadoBusca | { status: "desligado" } | { status: "limite" };

const LIMITE_POR_MINUTO = 10;
const g = globalThis as unknown as { __buscaCoordenadas?: Map<string, number[]> };
const chamadas = (g.__buscaCoordenadas ??= new Map<string, number[]>());

/** Coordenada do endereço digitado no cadastro da unidade. Só o gestor chama; o gestor sempre confere o resultado. */
export async function buscarCoordenadas(endereco: string): Promise<RespostaBusca> {
  const gestor = await exigirGestorAcao();
  if (!buscaCoordenadas()) return { status: "desligado" };

  const texto = String(endereco ?? "").slice(0, 300);
  if (texto.trim().length < 5) return { status: "nao_encontrado" };

  const agora = Date.now();
  const recentes = (chamadas.get(gestor.id) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= LIMITE_POR_MINUTO) return { status: "limite" };
  chamadas.set(gestor.id, [...recentes, agora]);

  return coordenadasDoEndereco(texto);
}
