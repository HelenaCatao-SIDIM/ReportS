import "server-only";

/*
 * Ficha pública do CNES (DataSUS), para completar os estabelecimentos que vêm do Saúde com endereço e localização.
 *
 *   Ficha:  GET https://cnes.datasus.gov.br/services/estabelecimentos/{id}
 *           { noFantasia, noLogradouro, nuEndereco, bairro, cep, noMunicipio, uf, nuLatitude, nuLongitude, ... }
 *   O {id} é o código IBGE do município (6 dígitos) seguido do CNES (7 dígitos): 314710 + 0056170.
 *   Sem o município, a busca GET .../estabelecimentos?cnes=0056170 devolve [{ id, ... }].
 *
 * Sem login. As fichas mudam pouco: ficam guardadas por 24 horas. Falha numa ficha não impede a busca: o item fica só
 * com o que o Saúde tem.
 */

const BASE = "https://cnes.datasus.gov.br/services/estabelecimentos";
// O serviço do DataSUS responde às chamadas da própria página de consulta.
const CABECALHOS = { Accept: "application/json", Referer: "https://cnes.datasus.gov.br/pages/estabelecimentos/consulta.jsp" };
const TIMEOUT_MS = 10_000;
const VALIDADE_MS = 24 * 60 * 60_000;
const SIMULTANEAS = 6;

export interface FichaCnes {
  /** Nome fantasia no CNES (para conferir se o CNES do Saúde é mesmo daquele estabelecimento). */
  nome: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
}

const g = globalThis as unknown as { __fichasCnes?: Map<string, { em: number; ficha: FichaCnes | null }> };
const guardadas = (g.__fichasCnes ??= new Map());

const texto = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : typeof v === "number" ? String(v) : "");

function coordenada(v: unknown, limite: number): number | null {
  const n = typeof v === "number" ? v : Number(texto(v).replace(",", "."));
  return texto(v) && Number.isFinite(n) && Math.abs(n) <= limite && n !== 0 ? n : null;
}

const formatarCep = (cep: string) => {
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
};

/** Ficha → endereço de uma linha ("RUA X, 10 - BAIRRO, CIDADE/UF, CEP 35660-000") e coordenadas. */
export function lerFichaCnes(json: unknown): FichaCnes | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const logradouro = texto(o.noLogradouro);
  const numero = texto(o.nuEndereco);
  const bairro = texto(o.bairro);
  const cidade = [texto(o.noMunicipio), texto(o.uf)].filter(Boolean).join("/");
  const cep = texto(o.cep);
  const rua = [logradouro, numero].filter(Boolean).join(", ");
  const endereco = [[rua, bairro].filter(Boolean).join(" - "), cidade, cep && `CEP ${formatarCep(cep)}`].filter(Boolean).join(", ");
  const latitude = coordenada(o.nuLatitude, 90);
  const longitude = coordenada(o.nuLongitude, 180);
  return {
    nome: texto(o.noFantasia),
    endereco: logradouro ? endereco : "",
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
  };
}

async function json(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: CABECALHOS, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store", redirect: "error" });
  if (!r.ok) throw new Error(`CNES respondeu ${r.status}`);
  return r.json();
}

/** Id da ficha: município + CNES; sem o município, pergunta ao CNES pelo código. */
async function idDaFicha(cnes: string, municipio: string): Promise<string | null> {
  if (/^\d{6}$/.test(municipio)) return `${municipio}${cnes}`;
  const lista = await json(`${BASE}?cnes=${encodeURIComponent(cnes)}`);
  const id = Array.isArray(lista) && lista.length === 1 ? texto((lista[0] as Record<string, unknown>)?.id) : "";
  return /^\d{13}$/.test(id) ? id : null;
}

/** Ficha do CNES (guardada por 24 horas). Null se o código não for um CNES ou se o CNES não tiver a ficha. */
export async function fichaDoCnes(cnes: string, municipio: string, agora = Date.now()): Promise<FichaCnes | null> {
  const codigo = cnes.replace(/\D/g, "");
  if (codigo.length !== 7) return null;
  const chave = `${municipio}|${codigo}`;
  const guardada = guardadas.get(chave);
  if (guardada && agora - guardada.em < VALIDADE_MS) return guardada.ficha;
  try {
    const id = await idDaFicha(codigo, municipio.replace(/\D/g, ""));
    let ficha = id ? lerFichaCnes(await json(`${BASE}/${id}`)) : null;
    // Município do Saúde errado: tenta de novo só pelo CNES.
    if (!ficha?.nome && /^\d{6}$/.test(municipio)) {
      const outro = await idDaFicha(codigo, "");
      ficha = outro && outro !== id ? lerFichaCnes(await json(`${BASE}/${outro}`)) : ficha;
    }
    guardadas.set(chave, { em: agora, ficha: ficha?.nome ? ficha : null });
    return ficha?.nome ? ficha : null;
  } catch {
    return null; // fora do ar ou lento: não guarda, tenta de novo na próxima busca
  }
}

/** Fichas de vários CNES, poucas por vez (o DataSUS é lento e não deve ser sobrecarregado). Chave: "município|cnes". */
export async function fichasDoCnes(pedidos: { cnes: string; municipio: string }[]): Promise<Map<string, FichaCnes | null>> {
  const unicos = [...new Map(pedidos.map((p) => [`${p.municipio}|${p.cnes}`, p])).values()];
  const resultado = new Map<string, FichaCnes | null>();
  let proximo = 0;
  const trabalhar = async () => {
    while (proximo < unicos.length) {
      const p = unicos[proximo++];
      resultado.set(`${p.municipio}|${p.cnes}`, await fichaDoCnes(p.cnes, p.municipio));
    }
  };
  await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, unicos.length) }, trabalhar));
  return resultado;
}
