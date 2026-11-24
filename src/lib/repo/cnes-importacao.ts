import "server-only";

import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { listarEstabelecimentosMunicipais, fichasDoCnes } from "@/lib/cnes";
import { importarEstabelecimentosDoCnes, type EstabelecimentoDoCnes } from "./clientes";

export type ImportacaoMunicipal = { incluidos: number; atualizados: number };

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Busca **toda** a rede municipal do município no CNES (gestão municipal + natureza pública), completa cada um com o
 * endereço e as coordenadas da ficha e grava no cliente (de-dup por CNES no repo). Núcleo usado pela ação por cliente e
 * pelo job — **não** checa permissão: quem chama garante (a ação checa; o job só roda em chamada interna).
 * Devolve `null` quando o código é inválido ou o CNES não devolveu nada.
 */
export async function importarRedeMunicipal(clienteId: string, municipioIbge: string): Promise<ImportacaoMunicipal | null> {
  const cod = String(municipioIbge).replace(/\D/g, "");
  if (cod.length !== 6) return null;

  const lista = await listarEstabelecimentosMunicipais(cod);
  if (!lista.length) return null;

  const porCnes = new Map<string, string>();
  for (const e of lista) {
    const cnes = texto(e.cnes, 20).replace(/\D/g, "");
    const nome = texto(e.nome, 200);
    if (cnes.length === 7 && nome) porCnes.set(cnes, nome);
  }
  if (!porCnes.size) return null;

  const fichas = await fichasDoCnes([...porCnes.keys()].map((cnes) => ({ cnes, municipio: cod })));
  const itens: EstabelecimentoDoCnes[] = [...porCnes.entries()].map(([cnes, nome]) => {
    const f = fichas.get(`${cod}|${cnes}`);
    return { cnes, nome, endereco: texto(f?.endereco, 300), latitude: f?.latitude ?? null, longitude: f?.longitude ?? null };
  });

  return importarEstabelecimentosDoCnes(clienteId, itens, RAIO_PADRAO_METROS);
}
