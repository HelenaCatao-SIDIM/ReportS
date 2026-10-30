import "server-only";
import { geocodingUserAgent } from "@/lib/config";
import { aguardarVezNominatim, buscarJson } from "@/lib/cep";
import { normalizar } from "@/lib/format";

/*
 * Endereço → coordenada, para o cadastro do estabelecimento. Nominatim (OpenStreetMap): acerta a rua, não a porta,
 * então a administração sempre confere e pode ajustar. Mesmas regras de uso do CEP: User-Agent com contato,
 * no máximo 1 consulta por segundo (a fila é a mesma de src/lib/cep.ts), resultado guardado e chamada só pelo servidor.
 */

const NOMINATIM_BUSCA = "https://nominatim.openstreetmap.org/search";

export type ResultadoBusca =
  | { status: "ok"; latitude: number; longitude: number; descricao: string }
  | { status: "nao_encontrado" }
  | { status: "indisponivel" };

const g = globalThis as unknown as { __geocodificar?: Map<string, Extract<ResultadoBusca, { status: "ok" }>> };
const cache = (g.__geocodificar ??= new Map());

/** "Av. Brasil, 1500 — Centro" → "Av. Brasil, 1500, Centro" (o travessão confunde a busca). */
export const consultaDoEndereco = (endereco: string) => endereco.replace(/\s+[—–]\s+/g, ", ").replace(/\s+/g, " ").trim();

const numero = (v: unknown) => ((typeof v === "string" && v.trim()) || typeof v === "number" ? Number(v) : NaN);

/** Confere a resposta do Nominatim. `undefined` = formato inesperado (tratado como serviço indisponível). */
export function lerBusca(json: unknown): ResultadoBusca | undefined {
  if (!Array.isArray(json)) return undefined;
  if (json.length === 0) return { status: "nao_encontrado" };
  const primeiro = json[0];
  if (!primeiro || typeof primeiro !== "object") return undefined;
  const o = primeiro as Record<string, unknown>;
  const latitude = numero(o.lat);
  const longitude = numero(o.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  const descricao = typeof o.display_name === "string" ? o.display_name.trim().slice(0, 240) : "";
  return { status: "ok", latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)), descricao };
}

/** Primeira coordenada que o mapa devolve para o endereço. Nunca lança exceção. */
export async function coordenadasDoEndereco(endereco: string): Promise<ResultadoBusca> {
  const consulta = consultaDoEndereco(endereco);
  if (consulta.length < 5) return { status: "nao_encontrado" };

  const chave = normalizar(consulta);
  const guardado = cache.get(chave);
  if (guardado) return guardado;

  await aguardarVezNominatim();
  const url = `${NOMINATIM_BUSCA}?q=${encodeURIComponent(consulta)}&format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR`;
  const resultado = lerBusca(await buscarJson(url, { "User-Agent": geocodingUserAgent() }));
  if (!resultado) return { status: "indisponivel" };
  if (resultado.status === "ok") cache.set(chave, resultado);
  return resultado;
}
