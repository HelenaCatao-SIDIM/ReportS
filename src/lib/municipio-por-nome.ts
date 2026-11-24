import "server-only";
import { normalizar } from "@/lib/format";
import { ESTADOS, municipiosDoEstado, type MunicipioIbge } from "./ibge-municipios";

/*
 * Extrai o município do nome de um cliente prefeitura e resolve para o código IBGE (o que o CNES usa), sem o admin
 * digitar nada. Tira "Prefeitura de…", "Município de…", "Secretaria Municipal de Saúde de…" e "(…)" e procura o resto
 * na lista do IBGE. Nome de município se repete entre estados (homônimos), então só resolve sozinho quando há um único
 * município com aquele nome no Brasil; ambíguo ou desconhecido devolve null (a tela cai no seletor Estado -> Município).
 */

export interface MunicipioResolvido extends MunicipioIbge {
  uf: string;
}

/** Prefixos comuns no nome de uma prefeitura, do mais específico para o mais geral. */
const PREFIXOS = [
  /^secretaria municipal de saude (de|da|do|das|dos) /,
  /^secretaria municipal de saude /,
  /^secretaria de saude (de|da|do|das|dos) /,
  /^prefeitura municipal (de|da|do|das|dos) /,
  /^prefeitura municipal /,
  /^prefeitura (de|da|do|das|dos) /,
  /^prefeitura /,
  /^municipio (de|da|do|das|dos) /,
  /^municipio /,
];

/** Tira os prefixos e os parênteses do nome do cliente, deixando só o nome do município (normalizado). */
export function soMunicipio(nomeCliente: string): string {
  let s = normalizar(nomeCliente).replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  for (const p of PREFIXOS) {
    if (p.test(s)) {
      s = s.replace(p, "").trim();
      break;
    }
  }
  return s;
}

/** Índice "nome normalizado do município" -> municípios com esse nome (um por estado, quando repete). Montado uma vez. */
let indice: Map<string, MunicipioResolvido[]> | null = null;
function indiceDeNomes(): Map<string, MunicipioResolvido[]> {
  if (indice) return indice;
  const m = new Map<string, MunicipioResolvido[]>();
  for (const { uf } of ESTADOS) {
    for (const mun of municipiosDoEstado(uf)) {
      const chave = normalizar(mun.nome).replace(/\s+/g, " ");
      const lista = m.get(chave) ?? [];
      lista.push({ ...mun, uf });
      m.set(chave, lista);
    }
  }
  indice = m;
  return m;
}

export type ResolucaoMunicipio = { municipio: MunicipioResolvido } | { ambiguo: MunicipioResolvido[] } | null;

/**
 * Resolve o município pelo nome do cliente: único no Brasil -> { municipio }; em mais de um estado -> { ambiguo };
 * nada reconhecido -> null.
 */
export function resolverMunicipioPorCliente(nomeCliente: string): ResolucaoMunicipio {
  const alvo = soMunicipio(nomeCliente);
  if (!alvo) return null;
  const matches = indiceDeNomes().get(alvo) ?? [];
  if (matches.length === 1) return { municipio: matches[0] };
  if (matches.length > 1) return { ambiguo: matches };
  return null;
}
