"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { codigosSaudeDoCliente, importarEstabelecimentosDoSaude, listarSistemasDoCliente, type EstabelecimentoDoSaude } from "@/lib/repo/clientes";
import { enderecoApiDoTenant } from "@/lib/saude-login";
import { buscarEstabelecimentosNoSaude, type EstabelecimentoSaude } from "@/lib/saude-estabelecimentos";
import { fichasDoCnes } from "@/lib/cnes";

export interface BuscaSaudeState {
  erros?: Partial<Record<"usuario" | "senha" | "geral", string>>;
  /** O usuário digitado volta para o campo; a senha, nunca. */
  usuario?: string;
  itens?: EstabelecimentoSaude[];
  /** Códigos do Saúde que já estão no cliente (importados antes). */
  jaImportados?: string[];
}

/** Busca, só para ver, os estabelecimentos cadastrados no Saúde do cliente. Não grava nada. */
export async function buscarEstabelecimentosSaude(clienteId: string, _: BuscaSaudeState, fd: FormData): Promise<BuscaSaudeState> {
  await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const usuario = String(fd.get("usuario") ?? "").trim();
  const senha = String(fd.get("senha") ?? "");

  const erros: NonNullable<BuscaSaudeState["erros"]> = {};
  if (!usuario) erros.usuario = "Informe o usuário do Saúde.";
  if (!senha) erros.senha = "Informe a senha.";
  if (Object.keys(erros).length) return { erros, usuario };

  const saude = (await listarSistemasDoCliente(clienteId)).find((s) => s.sistema === "saude");
  if (!saude?.tenantId) return { erros: { geral: "O sistema Saúde deste cliente ainda não tem tenant (a ligação é feita no SINC)." }, usuario };
  const url = await enderecoApiDoTenant(saude.tenantId);
  if (!url) return { erros: { geral: `O tenant ${saude.tenantId} não foi encontrado no diretório de servidores do Saúde.` }, usuario };

  const r = await buscarEstabelecimentosNoSaude(url, usuario, senha);
  if (!r.ok) {
    return {
      erros: {
        geral: r.motivo === "credenciais" ? "O Saúde recusou o usuário ou a senha." : "Não foi possível falar com o Saúde deste cliente agora. Tente de novo em instantes.",
      },
      usuario,
    };
  }
  // Endereço e localização: da ficha do CNES de cada item que tem CNES (o Saúde quase nunca tem o endereço).
  const comCnes = r.itens.filter((i) => i.cnes);
  const fichas = await fichasDoCnes(comCnes.map((i) => ({ cnes: i.cnes, municipio: i.municipio })));
  const itens = r.itens.map((i) => {
    const f = i.cnes ? fichas.get(`${i.municipio}|${i.cnes}`) : null;
    return f ? { ...i, cnesNome: f.nome, cnesEndereco: f.endereco, latitude: f.latitude, longitude: f.longitude } : i;
  });
  return { usuario, itens, jaImportados: await codigosSaudeDoCliente(clienteId) };
}

export type ResultadoImportacao = { ok: true; incluidos: number; atualizados: number } | { ok: false; erro: string };

/** Endereço que o cadastro grava: o da ficha do CNES; sem ela, o logradouro e o CEP que o Saúde tiver. */
const enderecoDoSaude = (i: Pick<EstabelecimentoSaude, "cnesEndereco" | "logradouro" | "cep">) =>
  i.cnesEndereco || [i.logradouro, i.cep && `CEP ${i.cep}`].filter(Boolean).join(" · ");

const coordenada = (v: unknown, limite: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limite ? v : null);

/**
 * Grava no cliente os estabelecimentos marcados na busca. A lista vem do navegador (a senha do Saúde não fica guardada para
 * buscar de novo): só a administração chega aqui, e cada campo é conferido e cortado no tamanho antes de gravar.
 */
export async function importarEstabelecimentosSaude(clienteId: string, itens: EstabelecimentoSaude[]): Promise<ResultadoImportacao> {
  await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  if (!(await listarSistemasDoCliente(clienteId)).some((s) => s.sistema === "saude")) return { ok: false, erro: "Este cliente não tem o sistema Saúde." };
  if (!Array.isArray(itens) || itens.length === 0) return { ok: false, erro: "Marque ao menos um estabelecimento." };
  if (itens.length > 2000) return { ok: false, erro: "Lista grande demais." };

  const t = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const porCodigo = new Map<string, EstabelecimentoDoSaude>();
  for (const i of itens) {
    const codigo = t(i?.codigo, 50);
    const nome = t(i?.nome, 200);
    if (!codigo || !nome) continue;
    const latitude = coordenada(i.latitude, 90);
    const longitude = coordenada(i.longitude, 180);
    const temLocal = latitude !== null && longitude !== null;
    porCodigo.set(codigo, {
      codigo,
      nome,
      cnes: t(i.cnes, 20),
      endereco: t(enderecoDoSaude({ cnesEndereco: t(i.cnesEndereco, 300), logradouro: t(i.logradouro, 200), cep: t(i.cep, 20) }), 300),
      latitude: temLocal ? latitude : null,
      longitude: temLocal ? longitude : null,
    });
  }
  if (porCodigo.size === 0) return { ok: false, erro: "Nenhum estabelecimento válido na lista." };

  const r = await importarEstabelecimentosDoSaude(clienteId, [...porCodigo.values()], RAIO_PADRAO_METROS);
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: true, ...r };
}
