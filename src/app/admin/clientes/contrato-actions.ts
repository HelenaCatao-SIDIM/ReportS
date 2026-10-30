"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { emailValido } from "@/lib/format";
import { buscarSistemaDoCliente } from "@/lib/repo/clientes";
import { buscarAprovador, buscarAprovadorPorEmail, criarAprovador } from "@/lib/repo/aprovadores";
import { buscarContratoDoSistemaDoCliente, salvarContrato } from "@/lib/repo/contratos";
import type { NivelComprovacao } from "@/lib/types";

export interface NovoAprovadorForm {
  nome: string;
  cargo: string;
  email: string;
}

export interface ContratoFormState {
  erros?: Partial<Record<"texto" | "aprovadores" | "geral", string>>;
  /** Erro por linha de aprovador novo (índice → mensagem). */
  errosNovos?: Record<number, string>;
  valores?: { texto: string; nivel: NivelComprovacao; exigeCpf: boolean; ativo: boolean; aprovadorIds: string[]; novos: NovoAprovadorForm[] };
}

function lerContrato(fd: FormData) {
  let novos: NovoAprovadorForm[] = [];
  try {
    novos = (JSON.parse(String(fd.get("novos") ?? "[]")) as NovoAprovadorForm[]).map((a) => ({
      nome: String(a.nome ?? "").trim(),
      cargo: String(a.cargo ?? "").trim(),
      email: String(a.email ?? "").trim().toLowerCase(),
    }));
  } catch {}
  return {
    texto: String(fd.get("texto") ?? "").trim(),
    nivel: (fd.get("nivel") === "assinado" ? "assinado" : "nominal") as NivelComprovacao,
    exigeCpf: fd.get("exigeCpf") !== null,
    ativo: fd.get("ativo") !== null,
    aprovadorIds: [...new Set(fd.getAll("aprovadorIds").map(String))],
    // Linhas totalmente vazias são ignoradas.
    novos: novos.filter((a) => a.nome || a.cargo || a.email),
  };
}

/** Cria ou atualiza o contrato do sistema do cliente. Aprovadores novos entram no cadastro de aprovadores. */
export async function salvarContratoDoSistema(clienteId: string, sistemaDoClienteId: string, _: ContratoFormState, fd: FormData): Promise<ContratoFormState> {
  await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const sdc = await buscarSistemaDoCliente(sistemaDoClienteId);
  if (!sdc || sdc.clienteId !== clienteId) return { erros: { geral: "Sistema do cliente não encontrado." } };
  const existente = await buscarContratoDoSistemaDoCliente(sistemaDoClienteId);

  const d = lerContrato(fd);
  // No primeiro cadastro o contrato nasce ativo; a caixa só existe na edição.
  if (!existente) d.ativo = true;

  const erros: NonNullable<ContratoFormState["erros"]> = {};
  const errosNovos: Record<number, string> = {};
  if (!d.texto) erros.texto = "Informe o contrato (aparece na capa do relatório).";

  // Aprovadores marcados: precisam existir; ao menos um tem de estar ativo.
  const marcados = (await Promise.all(d.aprovadorIds.map(buscarAprovador))).filter((a) => !!a);
  const vistos = new Set<string>();
  for (const [i, a] of d.novos.entries()) {
    if (!a.nome) errosNovos[i] = "Informe o nome.";
    else if (!emailValido(a.email)) errosNovos[i] = "E-mail inválido.";
    else if (vistos.has(a.email)) errosNovos[i] = "E-mail repetido.";
    else if (await buscarAprovadorPorEmail(a.email)) errosNovos[i] = "Este e-mail já está no cadastro: marque a pessoa na lista.";
    vistos.add(a.email);
  }
  if (marcados.filter((a) => a.ativo).length + d.novos.length === 0) erros.aprovadores = "Escolha pelo menos um aprovador (ou cadastre um novo).";

  if (Object.keys(erros).length || Object.keys(errosNovos).length) return { erros, errosNovos, valores: d };

  const criados = [];
  for (const a of d.novos) criados.push(await criarAprovador(a));
  await salvarContrato(sistemaDoClienteId, {
    texto: d.texto,
    nivel: d.nivel,
    exigeCpf: d.exigeCpf,
    ativo: d.ativo,
    aprovadorIds: [...marcados.map((a) => a!.id), ...criados.map((a) => a.id)],
  });
  revalidatePath(`/admin/clientes/${clienteId}`);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/aprovadores");
  redirect(`/admin/clientes/${clienteId}?ok=contrato`);
}
