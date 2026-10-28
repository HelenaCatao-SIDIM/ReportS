import "server-only";
import { geocodingUserAgent } from "@/lib/config";
import { normalizar, soDigitos } from "@/lib/format";
import type { EnderecoVisita } from "@/lib/types";

/*
 * Coordenada → CEP + endereço.
 *
 * 1. Nominatim (OpenStreetMap): rua, bairro, cidade, UF e, quando existe, o CEP.
 * 2. Sem CEP no Nominatim (comum no Brasil): busca pela rua no ViaCEP. O CEP fica marcado como aproximado
 *    (ruas longas têm um CEP por trecho; cidades pequenas têm um CEP geral).
 * Nunca inventa CEP. Falha de rede vira status "falhou" (não fica em cache, tenta de novo depois).
 *
 * Regras de uso do Nominatim: User-Agent com contato, no máximo 1 requisição por segundo,
 * resultado guardado (cache) e chamada só pelo servidor.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const VIACEP = "https://viacep.com.br/ws";
const TIMEOUT_MS = 5000;
/** Folga acima de 1 s entre chamadas ao Nominatim. */
const INTERVALO_MS = 1100;

const UFS: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF",
  "espirito santo": "ES", goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI",
  "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

/** Tipos de logradouro que o ViaCEP às vezes não encontra junto com o nome. */
const TIPOS_LOGRADOURO = /^(rua|r\.|avenida|av\.?|travessa|tv\.?|alameda|al\.?|rodovia|rod\.?|estrada|est\.?|praca|praça|pca\.?|largo|via)\s+/i;

interface Estado {
  cache: Map<string, EnderecoVisita>;
  emAndamento: Map<string, Promise<EnderecoVisita>>;
  /** Momento (ms) liberado para a próxima chamada ao Nominatim. */
  proximo: number;
}

// Mantém cache e fila entre recargas do servidor de desenvolvimento (como os repositórios).
const g = globalThis as unknown as { __cep?: Estado };
const estado = (g.__cep ??= { cache: new Map(), emAndamento: new Map(), proximo: 0 });

const chave = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export async function aguardarVezNominatim() {
  const agora = Date.now();
  const vez = Math.max(agora, estado.proximo);
  estado.proximo = vez + INTERVALO_MS;
  if (vez > agora) await new Promise((r) => setTimeout(r, vez - agora));
}

/** GET com timeout. Devolve o JSON, ou `undefined` em erro de rede, timeout ou resposta não 2xx. */
export async function buscarJson(url: string, headers: Record<string, string> = {}): Promise<unknown | undefined> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!r.ok) return undefined;
    return await r.json();
  } catch {
    return undefined;
  }
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** "87020-000" → "87020000"; qualquer coisa que não tenha exatamente 8 dígitos → null. */
export function cepValido(v: unknown): string | null {
  const d = typeof v === "string" ? soDigitos(v) : "";
  return d.length === 8 ? d : null;
}

function siglaUf(address: Record<string, unknown>): string | null {
  const iso = texto(address["ISO3166-2-lvl4"]);
  if (iso?.startsWith("BR-") && iso.length === 5) return iso.slice(3);
  const nome = texto(address.state);
  return nome ? (UFS[normalizar(nome)] ?? null) : null;
}

interface Parcial {
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

/** Lê a resposta do Nominatim. `undefined` = falha de rede/resposta inválida. */
export function lerNominatim(json: unknown): (Parcial & { cep: string | null }) | undefined {
  if (!json || typeof json !== "object") return undefined;
  const r = json as Record<string, unknown>;
  // Coordenada sem endereço (ex.: no meio do mar): resposta válida, mas vazia.
  if (r.error) return { cep: null, logradouro: null, bairro: null, cidade: null, uf: null };
  const a = (r.address && typeof r.address === "object" ? r.address : {}) as Record<string, unknown>;
  return {
    cep: cepValido(a.postcode),
    logradouro: texto(a.road) ?? texto(a.pedestrian) ?? texto(a.footway),
    bairro: texto(a.suburb) ?? texto(a.neighbourhood) ?? texto(a.quarter) ?? texto(a.city_district),
    cidade: texto(a.city) ?? texto(a.town) ?? texto(a.village) ?? texto(a.municipality),
    uf: siglaUf(a),
  };
}

interface ItemViaCep {
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  localidade: string | null;
  uf: string | null;
}

/** Lê a resposta da busca por endereço do ViaCEP (lista). `undefined` = falha de rede/resposta inválida. */
export function lerViaCep(json: unknown): ItemViaCep[] | undefined {
  if (Array.isArray(json)) {
    return json
      .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
      .map((x) => ({ cep: cepValido(x.cep) ?? "", logradouro: texto(x.logradouro), bairro: texto(x.bairro), localidade: texto(x.localidade), uf: texto(x.uf) }))
      .filter((x) => x.cep);
  }
  // { "erro": true } = nada encontrado.
  if (json && typeof json === "object" && (json as Record<string, unknown>).erro) return [];
  return undefined;
}

/** Escolhe o CEP da lista do ViaCEP: o do mesmo bairro; senão, o único; senão, o primeiro. */
export function escolherCep(lista: ItemViaCep[], bairro: string | null): ItemViaCep | null {
  if (!lista.length) return null;
  if (bairro) {
    const b = normalizar(bairro);
    const mesmo = lista.find((x) => x.bairro && normalizar(x.bairro) === b);
    if (mesmo) return mesmo;
  }
  return lista[0];
}

async function buscarViaCep(uf: string, cidade: string, rua: string) {
  if (uf.length !== 2 || cidade.length < 3 || rua.length < 3) return [];
  return lerViaCep(await buscarJson(`${VIACEP}/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`));
}

const agoraIso = () => new Date().toISOString();

function falhou(): EnderecoVisita {
  return { status: "falhou", cep: null, aproximado: false, logradouro: null, bairro: null, cidade: null, uf: null, fonte: null, atualizadoEm: agoraIso() };
}

async function resolverSemCache(lat: number, lng: number): Promise<EnderecoVisita> {
  await aguardarVezNominatim();
  const url = `${NOMINATIM}?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=pt-BR`;
  const n = lerNominatim(await buscarJson(url, { "User-Agent": geocodingUserAgent() }));
  if (!n) return falhou();

  const base = { logradouro: n.logradouro, bairro: n.bairro, cidade: n.cidade, uf: n.uf, atualizadoEm: agoraIso() };
  if (n.cep) return { ...base, status: "ok", cep: n.cep, aproximado: false, fonte: "nominatim" };

  // Sem CEP no OpenStreetMap: tenta pela rua no ViaCEP.
  if (n.uf && n.cidade) {
    const tentativas = n.logradouro ? [n.logradouro, n.logradouro.replace(TIPOS_LOGRADOURO, "")] : [];
    // Cidades pequenas costumam ter um CEP geral; "Centro" é o último recurso.
    tentativas.push("Centro");
    for (const rua of [...new Set(tentativas)]) {
      const lista = await buscarViaCep(n.uf, n.cidade, rua);
      if (lista === undefined) return { ...falhou(), ...base, status: "falhou" };
      const pelaRua = rua !== "Centro";
      // No "Centro", só serve o CEP geral da cidade (sem logradouro): numa cidade grande, um CEP
      // qualquer de uma rua com "Centro" no nome estaria errado.
      const item = escolherCep(pelaRua ? lista : lista.filter((x) => !x.logradouro), n.bairro);
      if (item) {
        return {
          status: "ok",
          cep: item.cep,
          aproximado: true,
          // Quando o CEP veio pela rua, o ViaCEP traz os nomes oficiais; no "Centro", mantém os do mapa.
          logradouro: pelaRua ? (item.logradouro ?? n.logradouro) : n.logradouro,
          bairro: pelaRua ? (item.bairro ?? n.bairro) : n.bairro,
          cidade: item.localidade ?? n.cidade,
          uf: item.uf ?? n.uf,
          fonte: "viacep",
          atualizadoEm: agoraIso(),
        };
      }
    }
  }
  return { ...base, status: "sem_cep", cep: null, aproximado: false, fonte: n.logradouro || n.cidade ? "nominatim" : null };
}

/** Resultado definitivo já guardado para a coordenada (o da prévia mostrada ao técnico), ou null. */
export function cepEmCache(lat: number, lng: number): EnderecoVisita | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return estado.cache.get(chave(lat, lng)) ?? null;
}

/**
 * CEP + endereço de uma coordenada. Nunca lança exceção: em falha devolve status "falhou".
 * Guarda em cache (coordenada com 4 casas, ~11 m) os resultados definitivos ("ok" e "sem_cep").
 */
export async function resolverCep(lat: number, lng: number): Promise<EnderecoVisita> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return falhou();
  const k = chave(lat, lng);
  const guardado = estado.cache.get(k);
  if (guardado) return guardado;
  const andamento = estado.emAndamento.get(k);
  if (andamento) return andamento;

  const p = resolverSemCache(lat, lng)
    .catch(() => falhou())
    .then((e) => {
      if (e.status === "ok" || e.status === "sem_cep") estado.cache.set(k, e);
      return e;
    })
    .finally(() => estado.emAndamento.delete(k));
  estado.emAndamento.set(k, p);
  return p;
}
