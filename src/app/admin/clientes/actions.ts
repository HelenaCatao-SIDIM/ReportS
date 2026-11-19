"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { cnpjValido, normalizar, soDigitos } from "@/lib/format";
import * as repo from "@/lib/repo/clientes";
import { listarSistemas } from "@/lib/repo/sistemas";
import { mudancasDe, registrarAuditoria } from "@/lib/repo/auditoria";

// ---------- Cliente ----------

/** Limite de nomes do cliente no SINC (o fluxo do n8n aceita até 10). */
const MAX_NOMES_FORTICS = 10;

export interface ClienteFormState {
  erros?: Partial<Record<"nome" | "cnpj" | "sistemas" | "nomesFortics", string>>;
  valores?: { nome: string; cnpj: string; ativo: boolean; nomesFortics: string[]; sistemas: string[] };
}

/** `nomesPadrao`: valor usado quando o campo não vem no formulário (ele só aparece com os chamados de suporte ligados). */
function lerCliente(fd: FormData, nomesPadrao: string[] = []) {
  return {
    nome: String(fd.get("nome") ?? "").trim(),
    cnpj: soDigitos(String(fd.get("cnpj") ?? "")),
    ativo: fd.get("ativo") !== null,
    // Um nome por linha, sem repetidos (comparação sem acento e sem caixa).
    nomesFortics: fd.has("nomesFortics")
      ? String(fd.get("nomesFortics") ?? "")
          .split(/\r?\n/)
          .map((n) => n.replace(/\s+/g, " ").trim())
          .filter((n, i, todos) => n && todos.findIndex((x) => normalizar(x) === normalizar(n)) === i)
      : nomesPadrao,
    sistemas: [...new Set(fd.getAll("sistemas").map(String))],
  };
}

/** `cnpjPendente`: cliente que veio do SINC sem CNPJ pode continuar sem (RN-PL-11); o cliente criado à mão sempre informa. */
async function validarCliente(d: ReturnType<typeof lerCliente>, opcoes: { id?: string; exigirSistema: boolean; cnpjPendente?: boolean }) {
  const erros: NonNullable<ClienteFormState["erros"]> = {};

  if (d.nome.length < 2) erros.nome = "Informe o nome do cliente.";
  if (!d.cnpj && opcoes.cnpjPendente) {
    // permanece "CNPJ pendente"
  } else if (!cnpjValido(d.cnpj)) erros.cnpj = "CNPJ inválido.";
  else if (await repo.cnpjEmUso(d.cnpj, opcoes.id)) erros.cnpj = "Já existe um cliente com este CNPJ.";
  if (d.nomesFortics.length > MAX_NOMES_FORTICS) erros.nomesFortics = `Informe no máximo ${MAX_NOMES_FORTICS} nomes.`;
  else if (d.nomesFortics.some((n) => n.length > 120)) erros.nomesFortics = "Cada nome pode ter até 120 caracteres.";

  if (opcoes.exigirSistema && d.sistemas.length === 0) erros.sistemas = "Escolha pelo menos um sistema do cliente.";
  const ativos = new Set((await listarSistemas()).map((s) => s.codigo));
  if (d.sistemas.some((codigo) => !ativos.has(codigo))) erros.sistemas = "Escolha apenas sistemas da lista.";
  return erros;
}

export async function criarCliente(_: ClienteFormState, fd: FormData): Promise<ClienteFormState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const d = lerCliente(fd);
  const erros = await validarCliente(d, { exigirSistema: true });
  if (Object.keys(erros).length) return { erros, valores: d };

  const c = await repo.criarCliente({ nome: d.nome, cnpj: d.cnpj, ativo: true, nomesFortics: d.nomesFortics }, d.sistemas, usuario.id);
  await registrarAuditoria({
    autor: usuario, entidade: "cliente", entidadeId: c.id, rotulo: d.nome, acao: "criar",
    mudancas: mudancasDe([
      { campo: "Nome", antes: undefined, depois: d.nome },
      { campo: "CNPJ", antes: undefined, depois: d.cnpj },
      { campo: "Sistemas (qtde)", antes: undefined, depois: d.sistemas.length },
    ]),
  });
  revalidatePath("/admin/clientes");
  // Segue para a tela do cliente, onde ficam os contratos e os estabelecimentos.
  redirect(`/admin/clientes/${c.id}?ok=criado`);
}

export async function editarCliente(id: string, _: ClienteFormState, fd: FormData): Promise<ClienteFormState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const atual = await repo.buscarCliente(id);
  if (!atual) return { erros: { nome: "Cliente não encontrado." } };
  // Com os chamados de suporte desligados o campo não aparece no formulário; os nomes já cadastrados ficam como estão.
  const d = lerCliente(fd, atual.nomesFortics);
  // Com vínculo no ClickUp o nome é o da opção (RN-PL-12): o campo vem travado e o nome atual vale.
  if (atual.nomeDoClickUp) d.nome = atual.nome;
  const erros = await validarCliente(d, { id, exigirSistema: false, cnpjPendente: atual.origem === "sinc" });
  const jaTem = new Set((await repo.listarSistemasDoCliente(id)).map((x) => x.sistema));
  if (d.sistemas.some((codigo) => jaTem.has(codigo))) erros.sistemas = "O cliente já tem um destes sistemas.";
  if (Object.keys(erros).length) return { erros, valores: d };

  await repo.atualizarCliente(id, { nome: d.nome, cnpj: d.cnpj, ativo: d.ativo, nomesFortics: d.nomesFortics });
  for (const codigo of d.sistemas) await repo.adicionarSistemaAoCliente(id, codigo);
  await registrarAuditoria({
    autor: usuario, entidade: "cliente", entidadeId: id, rotulo: d.nome, acao: "editar",
    mudancas: mudancasDe([
      { campo: "Nome", antes: atual.nome, depois: d.nome },
      { campo: "CNPJ", antes: atual.cnpj, depois: d.cnpj },
      { campo: "Ativo", antes: atual.ativo, depois: d.ativo },
      { campo: "Nomes no SINC (qtde)", antes: atual.nomesFortics.length, depois: d.nomesFortics.length },
      ...(d.sistemas.length ? [{ campo: "Sistemas adicionados (qtde)", antes: 0, depois: d.sistemas.length }] : []),
    ]),
  });
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${id}?ok=salvo`);
}

// ---------- Estabelecimento ----------

export interface UnidadeFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "latitude" | "longitude" | "raio", string>>;
  /** Valores digitados, devolvidos quando há erro (o formulário é limpo após o envio). */
  valores?: { nome: string; endereco: string; latitude: string; longitude: string; raio: string };
}

function lerCoordenada(valor: FormDataEntryValue | null, limite: number): number | null | "invalida" {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= limite ? n : "invalida";
}

/** Metros inteiros; vazio volta ao padrão. Abaixo de 10 m o erro natural do GPS já geraria alerta em todo check-in. */
function lerRaio(valor: FormDataEntryValue | null): number | "invalido" {
  const s = String(valor ?? "").trim();
  if (!s) return RAIO_PADRAO_METROS;
  const n = Number(s);
  return Number.isInteger(n) && n >= 10 && n <= 5000 ? n : "invalido";
}

export async function salvarUnidade(
  clienteId: string,
  unidadeId: string | null,
  _: UnidadeFormState,
  fd: FormData,
): Promise<UnidadeFormState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const nome = String(fd.get("nome") ?? "").trim();
  const endereco = String(fd.get("endereco") ?? "").trim();
  const latitude = lerCoordenada(fd.get("latitude"), 90);
  const longitude = lerCoordenada(fd.get("longitude"), 180);
  const raio = lerRaio(fd.get("raio"));

  const erros: NonNullable<UnidadeFormState["erros"]> = {};
  if (!nome) erros.nome = "Informe o nome do estabelecimento.";
  if (latitude === "invalida") erros.latitude = "Número entre -90 e 90.";
  if (longitude === "invalida") erros.longitude = "Número entre -180 e 180.";
  if (raio === "invalido") erros.raio = "Número inteiro de metros, de 10 a 5000.";
  if (Object.keys(erros).length) {
    return {
      erros,
      valores: { nome, endereco, latitude: String(fd.get("latitude") ?? ""), longitude: String(fd.get("longitude") ?? ""), raio: String(fd.get("raio") ?? "") },
    };
  }

  const dados = { nome, endereco, latitude: latitude as number | null, longitude: longitude as number | null, raioMetros: raio as number };
  const campos = (antes: Partial<typeof dados> | null) => [
    { campo: "Nome", antes: antes?.nome, depois: dados.nome },
    { campo: "Endereço", antes: antes?.endereco, depois: dados.endereco },
    { campo: "Raio (m)", antes: antes?.raioMetros, depois: dados.raioMetros },
    { campo: "Latitude", antes: antes?.latitude, depois: dados.latitude },
    { campo: "Longitude", antes: antes?.longitude, depois: dados.longitude },
  ];
  if (unidadeId) {
    const antes = await repo.buscarUnidade(unidadeId);
    await repo.atualizarUnidade(unidadeId, dados);
    await registrarAuditoria({ autor: usuario, entidade: "estabelecimento", entidadeId: unidadeId, rotulo: nome, acao: "editar", mudancas: mudancasDe(campos(antes)) });
  } else {
    const u = await repo.criarUnidade(clienteId, dados);
    await registrarAuditoria({ autor: usuario, entidade: "estabelecimento", entidadeId: u.id, rotulo: nome, acao: "criar", mudancas: mudancasDe(campos(null)) });
  }

  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: true };
}

/** Retorna a mensagem de erro, se houver (estabelecimento com visitas não é removido). */
export async function removerUnidade(unidadeId: string): Promise<string | null> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.clientesCadastrar);
  const u = await repo.buscarUnidade(unidadeId);
  if (!u) return null;
  try {
    await repo.removerUnidade(unidadeId);
  } catch (e) {
    if (e instanceof repo.EmUsoError) return e.message;
    throw e;
  }
  await registrarAuditoria({ autor: usuario, entidade: "estabelecimento", entidadeId: unidadeId, rotulo: u.nome, acao: "excluir" });
  revalidatePath(`/admin/clientes/${u.clienteId}`);
  return null;
}

