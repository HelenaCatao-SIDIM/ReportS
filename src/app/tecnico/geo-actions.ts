"use server";

import { exigirTecnicoAcao } from "@/lib/dal";
import { localizacaoPorCep } from "@/lib/config";
import { resolverCep } from "@/lib/cep";
import type { StatusEndereco } from "@/lib/types";

/** O que a tela do técnico recebe: só o endereço, nunca a coordenada. */
export interface PreviaCep {
  status: StatusEndereco;
  cep: string | null;
  aproximado: boolean;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

const LIMITE_POR_MINUTO = 10;
const g = globalThis as unknown as { __previaCep?: Map<string, number[]> };
const chamadas = (g.__previaCep ??= new Map<string, number[]>());

/** Prévia do CEP para o técnico ver antes de confirmar o check-in/check-out. */
export async function previaCep(latitude: number, longitude: number): Promise<PreviaCep | null> {
  const tecnico = await exigirTecnicoAcao();
  if (!localizacaoPorCep()) return null;

  const agora = Date.now();
  const recentes = (chamadas.get(tecnico.id) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= LIMITE_POR_MINUTO) return null;
  chamadas.set(tecnico.id, [...recentes, agora]);

  const e = await resolverCep(Number(latitude), Number(longitude));
  return { status: e.status, cep: e.cep, aproximado: e.aproximado, logradouro: e.logradouro, bairro: e.bairro, cidade: e.cidade, uf: e.uf };
}
