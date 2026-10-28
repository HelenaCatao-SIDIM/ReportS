"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirGestorAcao } from "@/lib/dal";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { cnpjValido, emailValido, normalizar, soDigitos } from "@/lib/format";
import * as repo from "@/lib/repo/clientes";
import type { NivelComprovacao } from "@/lib/types";

// ---------- Cliente ----------

/** Limite de nomes do cliente no Fortics (o fluxo do n8n aceita até 10). */
const MAX_NOMES_FORTICS = 10;

export interface AprovadorForm {
  nome: string;
  cargo: string;
  email: string;
}

export interface ClienteFormState {
  erros?: Partial<Record<"nome" | "cnpj" | "contrato" | "aprovadores" | "nomesFortics", string>>;
  /** Erro por linha de aprovador (índice → mensagem). */
  errosAprovadores?: Record<number, string>;
  valores?: { nome: string; cnpj: string; contrato: string; nivel: NivelComprovacao; exigeCpf: boolean; ativo: boolean; aprovadores: AprovadorForm[]; nomesFortics: string[] };
}

function lerCliente(fd: FormData) {
  let aprovadores: AprovadorForm[] = [];
  try {
    aprovadores = (JSON.parse(String(fd.get("aprovadores") ?? "[]")) as AprovadorForm[]).map((a) => ({
      nome: String(a.nome ?? "").trim(),
      cargo: String(a.cargo ?? "").trim(),
      email: String(a.email ?? "").trim().toLowerCase(),
    }));
  } catch {}
  return {
    nome: String(fd.get("nome") ?? "").trim(),
    cnpj: soDigitos(String(fd.get("cnpj") ?? "")),
    contrato: String(fd.get("contrato") ?? "").trim(),
    nivel: (fd.get("nivel") === "assinado" ? "assinado" : "nominal") as NivelComprovacao,
    exigeCpf: fd.get("exigeCpf") !== null,
    ativo: fd.get("ativo") !== null,
    // Linhas totalmente vazias são ignoradas.
    aprovadores: aprovadores.filter((a) => a.nome || a.cargo || a.email),
    // Um nome por linha, sem repetidos (comparação sem acento e sem caixa).
    nomesFortics: String(fd.get("nomesFortics") ?? "")
      .split(/\r?\n/)
      .map((n) => n.replace(/\s+/g, " ").trim())
      .filter((n, i, todos) => n && todos.findIndex((x) => normalizar(x) === normalizar(n)) === i),
  };
}

async function validarCliente(d: ReturnType<typeof lerCliente>, id?: string) {
  const erros: NonNullable<ClienteFormState["erros"]> = {};
  const errosAprovadores: Record<number, string> = {};

  if (d.nome.length < 2) erros.nome = "Informe o nome do cliente.";
  if (!cnpjValido(d.cnpj)) erros.cnpj = "CNPJ inválido.";
  else if (await repo.cnpjEmUso(d.cnpj, id)) erros.cnpj = "Já existe um cliente com este CNPJ.";
  if (!d.contrato) erros.contrato = "Informe o contrato (aparece na capa do relatório).";
  if (d.nomesFortics.length > MAX_NOMES_FORTICS) erros.nomesFortics = `Informe no máximo ${MAX_NOMES_FORTICS} nomes.`;
  else if (d.nomesFortics.some((n) => n.length > 120)) erros.nomesFortics = "Cada nome pode ter até 120 caracteres.";

  if (d.aprovadores.length === 0) erros.aprovadores = "Cadastre pelo menos um aprovador.";
  const vistos = new Set<string>();
  d.aprovadores.forEach((a, i) => {
    if (!a.nome) errosAprovadores[i] = "Informe o nome.";
    else if (!emailValido(a.email)) errosAprovadores[i] = "E-mail inválido.";
    else if (vistos.has(a.email)) errosAprovadores[i] = "E-mail repetido.";
    vistos.add(a.email);
  });
  return { erros, errosAprovadores };
}

const temErros = (r: { erros: object; errosAprovadores: object }) =>
  Object.keys(r.erros).length > 0 || Object.keys(r.errosAprovadores).length > 0;

export async function criarCliente(_: ClienteFormState, fd: FormData): Promise<ClienteFormState> {
  await exigirGestorAcao();
  const d = lerCliente(fd);
  const r = await validarCliente(d);
  if (temErros(r)) return { ...r, valores: d };

  const c = await repo.criarCliente({ ...d, ativo: true });
  revalidatePath("/admin/clientes");
  // Segue para a tela do cliente, onde as unidades são cadastradas.
  redirect(`/admin/clientes/${c.id}?ok=criado`);
}

export async function editarCliente(id: string, _: ClienteFormState, fd: FormData): Promise<ClienteFormState> {
  await exigirGestorAcao();
  const d = lerCliente(fd);
  const r = await validarCliente(d, id);
  if (temErros(r)) return { ...r, valores: d };

  await repo.atualizarCliente(id, d);
  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${id}?ok=salvo`);
}

// ---------- Unidade ----------

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
  await exigirGestorAcao();
  const nome = String(fd.get("nome") ?? "").trim();
  const endereco = String(fd.get("endereco") ?? "").trim();
  const latitude = lerCoordenada(fd.get("latitude"), 90);
  const longitude = lerCoordenada(fd.get("longitude"), 180);
  const raio = lerRaio(fd.get("raio"));

  const erros: NonNullable<UnidadeFormState["erros"]> = {};
  if (!nome) erros.nome = "Informe o nome da unidade.";
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
  if (unidadeId) await repo.atualizarUnidade(unidadeId, dados);
  else await repo.criarUnidade(clienteId, dados);

  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: true };
}

export async function removerUnidade(unidadeId: string) {
  await exigirGestorAcao();
  const u = await repo.buscarUnidade(unidadeId);
  if (!u) return;
  await repo.removerUnidade(unidadeId);
  revalidatePath(`/admin/clientes/${u.clienteId}`);
}

// ---------- Setor ----------

async function revalidarPorUnidade(unidadeId: string) {
  const u = await repo.buscarUnidade(unidadeId);
  if (u) revalidatePath(`/admin/clientes/${u.clienteId}`);
}

/** Cria (setorId null) ou renomeia um setor. Retorna mensagem de erro, se houver. */
export async function salvarSetor(unidadeId: string, setorId: string | null, nome: string): Promise<string | null> {
  await exigirGestorAcao();
  const n = nome.trim();
  if (!n) return "Informe o nome do setor.";
  if (await repo.setorDuplicado(unidadeId, n, setorId ?? undefined)) return "Este setor já existe na unidade.";

  if (setorId) await repo.renomearSetor(setorId, n);
  else await repo.criarSetor(unidadeId, n);
  await revalidarPorUnidade(unidadeId);
  return null;
}

export async function removerSetor(setorId: string) {
  await exigirGestorAcao();
  const s = await repo.buscarSetor(setorId);
  if (!s) return;
  await repo.removerSetor(setorId);
  await revalidarPorUnidade(s.unidadeId);
}
