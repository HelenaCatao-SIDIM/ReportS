"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { buscarCliente, cnesDoCliente, importarEstabelecimentosDoCnes, type EstabelecimentoDoCnes } from "@/lib/repo/clientes";
import { listarEstabelecimentosMunicipais, fichasDoCnes, type EstabelecimentoCnes } from "@/lib/cnes";
import { municipiosDoEstado as municipiosDoIbge, nomeDoMunicipio, type MunicipioIbge } from "@/lib/ibge-municipios";
import { resolverMunicipioPorCliente } from "@/lib/municipio-por-nome";
import { mudancasDe, registrarAuditoria } from "@/lib/repo/auditoria";

/** Municípios de um estado (sigla da UF) para o seletor. Lista do IBGE embutida; não bate em serviço externo. */
export async function municipiosDoEstado(uf: string): Promise<MunicipioIbge[]> {
  await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  return municipiosDoIbge(String(uf).trim().toUpperCase());
}

/**
 * O município do cliente, deduzido do nome dele ("Prefeitura de Pará de Minas" → 314710, MG), para a busca do CNES abrir
 * já resolvida. Null quando o nome não bate com um único município (ambíguo entre estados ou desconhecido): aí a tela
 * pede Estado → Município.
 */
export async function municipioDoClienteCnes(clienteId: string): Promise<{ codigo: string; nome: string; uf: string } | null> {
  await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const cliente = await buscarCliente(clienteId);
  if (!cliente) return null;
  const r = resolverMunicipioPorCliente(cliente.nome);
  return r && "municipio" in r ? r.municipio : null;
}

export type BuscaCnesState =
  | { ok: true; municipioIbge: string; municipioNome: string; itens: EstabelecimentoCnes[]; jaImportados: string[] }
  | { ok: false; erro: string };

/** Busca, só para ver, a rede municipal (gestão municipal + natureza pública) do município no CNES. Não grava nada. */
export async function buscarEstabelecimentosCnes(clienteId: string, municipioIbge: string): Promise<BuscaCnesState> {
  await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const cod = String(municipioIbge).replace(/\D/g, "");
  if (cod.length !== 6) return { ok: false, erro: "Escolha o estado e o município." };
  const itens = await listarEstabelecimentosMunicipais(cod);
  if (!itens.length) return { ok: false, erro: "O CNES não devolveu estabelecimentos de gestão municipal para esse município (ou está fora do ar). Tente de novo." };
  return { ok: true, municipioIbge: cod, municipioNome: nomeDoMunicipio(cod), itens, jaImportados: await cnesDoCliente(clienteId) };
}

export type ResultadoImportacaoCnes = { ok: true; incluidos: number; atualizados: number } | { ok: false; erro: string };

/**
 * Grava no cliente os estabelecimentos marcados na busca do CNES. A lista vem do navegador; aqui cada item é conferido,
 * e o endereço e as coordenadas de cada um são buscados na ficha do CNES (só dos escolhidos). De-dup por CNES no repo.
 */
export async function importarEstabelecimentosCnes(
  clienteId: string,
  municipioIbge: string,
  selecionados: { cnes: string; nome: string }[],
): Promise<ResultadoImportacaoCnes> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const cod = String(municipioIbge).replace(/\D/g, "");
  if (cod.length !== 6) return { ok: false, erro: "Município inválido." };
  if (!Array.isArray(selecionados) || selecionados.length === 0) return { ok: false, erro: "Marque ao menos um estabelecimento." };
  if (selecionados.length > 2000) return { ok: false, erro: "Lista grande demais." };

  const t = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const porCnes = new Map<string, string>();
  for (const s of selecionados) {
    const cnes = t(s?.cnes, 20).replace(/\D/g, "");
    const nome = t(s?.nome, 200);
    if (cnes.length === 7 && nome) porCnes.set(cnes, nome);
  }
  if (porCnes.size === 0) return { ok: false, erro: "Nenhum estabelecimento válido na lista." };

  // Endereço e localização de cada escolhido: da ficha do CNES (id = município + CNES).
  const fichas = await fichasDoCnes([...porCnes.keys()].map((cnes) => ({ cnes, municipio: cod })));
  const itens: EstabelecimentoDoCnes[] = [...porCnes.entries()].map(([cnes, nome]) => {
    const f = fichas.get(`${cod}|${cnes}`);
    return { cnes, nome, endereco: t(f?.endereco, 300), latitude: f?.latitude ?? null, longitude: f?.longitude ?? null };
  });

  const r = await importarEstabelecimentosDoCnes(clienteId, itens, RAIO_PADRAO_METROS);
  await registrarAuditoria({
    autor: usuario, entidade: "estabelecimento", entidadeId: clienteId, rotulo: `Importação do CNES (${nomeDoMunicipio(cod) || cod})`, acao: "importar",
    mudancas: mudancasDe([
      { campo: "Incluídos", antes: 0, depois: r.incluidos },
      { campo: "Atualizados", antes: 0, depois: r.atualizados },
    ]),
  });
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: true, ...r };
}

export type ResultadoMunicipalCnes =
  | { ok: true; municipio: string; incluidos: number; atualizados: number }
  | { ok: false; motivo: "sem_municipio" | "ambiguo" | "cnes_vazio" | "erro"; municipio?: string };

/**
 * Importa automaticamente a rede municipal do CNES de um cliente, deduzindo o município pelo nome dele e trazendo
 * **todos** os estabelecimentos (gestão municipal + natureza pública). Usado no "Atualizar estabelecimentos" (um por
 * cliente) e na importação automática do cliente prefeitura sem estabelecimentos. Nome ambíguo (homônimo) ou desconhecido
 * não roda sozinho: devolve o motivo para a tela pedir Estado → Município.
 */
export async function importarMunicipalDoCliente(clienteId: string): Promise<ResultadoMunicipalCnes> {
  await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const cliente = await buscarCliente(clienteId);
  if (!cliente) return { ok: false, motivo: "erro" };
  const r = resolverMunicipioPorCliente(cliente.nome);
  if (!r) return { ok: false, motivo: "sem_municipio" };
  if (!("municipio" in r)) return { ok: false, motivo: "ambiguo" };
  const { codigo, nome } = r.municipio;
  const itens = await listarEstabelecimentosMunicipais(codigo);
  if (!itens.length) return { ok: false, motivo: "cnes_vazio", municipio: nome };
  const imp = await importarEstabelecimentosCnes(clienteId, codigo, itens.map((i) => ({ cnes: i.cnes, nome: i.nome })));
  return imp.ok ? { ok: true, municipio: nome, incluidos: imp.incluidos, atualizados: imp.atualizados } : { ok: false, motivo: "erro", municipio: nome };
}
