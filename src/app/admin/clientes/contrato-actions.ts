"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { emailValido } from "@/lib/format";
import { buscarSistemaDoCliente } from "@/lib/repo/clientes";
import { buscarAprovador, buscarAprovadorPorEmail, criarAprovador } from "@/lib/repo/aprovadores";
import { buscarContratoDoSistemaDoCliente, salvarContrato } from "@/lib/repo/contratos";
import { configLoginDoSistema } from "@/lib/repo/presenca-login";
import { mudancasDe, registrarAuditoria } from "@/lib/repo/auditoria";
import { NIVEIS_VALIDOS } from "@/lib/contratos";
import type { NivelComprovacao, TipoRelatorioAtendimentos } from "@/lib/types";

export interface NovoAprovadorForm {
  nome: string;
  cargo: string;
  email: string;
}

export interface ContratoFormState {
  erros?: Partial<Record<"texto" | "aprovadores" | "geral", string>>;
  /** Erro por linha de aprovador novo (índice → mensagem). */
  errosNovos?: Record<number, string>;
  valores?: { texto: string; nivel: NivelComprovacao; exigeCpf: boolean; relatorioAtendimentos: TipoRelatorioAtendimentos; ativo: boolean; aprovadorIds: string[]; novos: NovoAprovadorForm[] };
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
    nivel: (NIVEIS_VALIDOS.has(String(fd.get("nivel") ?? "") as NivelComprovacao) ? String(fd.get("nivel")) : "nominal") as NivelComprovacao,
    exigeCpf: fd.get("exigeCpf") !== null,
    relatorioAtendimentos: (fd.get("relatorioAtendimentos") === "analitico" ? "analitico" : "sintetico") as TipoRelatorioAtendimentos,
    ativo: fd.get("ativo") !== null,
    aprovadorIds: [...new Set(fd.getAll("aprovadorIds").map(String))],
    // Linhas totalmente vazias são ignoradas.
    novos: novos.filter((a) => a.nome || a.cargo || a.email),
  };
}

/** Cria ou atualiza o contrato do sistema do cliente. Aprovadores novos entram no cadastro de aprovadores. */
export async function salvarContratoDoSistema(clienteId: string, sistemaDoClienteId: string, _: ContratoFormState, fd: FormData): Promise<ContratoFormState> {
  const usuario = await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const sdc = await buscarSistemaDoCliente(sistemaDoClienteId);
  if (!sdc || sdc.clienteId !== clienteId) return { erros: { geral: "Sistema do cliente não encontrado." } };
  const existente = await buscarContratoDoSistemaDoCliente(sistemaDoClienteId);

  const d = lerContrato(fd);
  // No primeiro cadastro o contrato nasce ativo; a caixa só existe na edição.
  if (!existente) d.ativo = true;

  const erros: NonNullable<ContratoFormState["erros"]> = {};
  const errosNovos: Record<number, string> = {};
  if (!d.texto) erros.texto = "Informe o contrato (aparece na capa do relatório).";
  // Login só vale onde o sistema do cliente tem login do participante (hoje, Saúde).
  if (d.nivel === "login" && !(await configLoginDoSistema(sistemaDoClienteId))) {
    erros.geral = "A comprovação por login só vale para sistemas com login do participante (Saúde). Escolha Nominal ou Assinado.";
  }

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
  // Aprovador é opcional: sem ele o relatório é emitido e o PDF é baixado para enviar por fora; só o envio por e-mail precisa de aprovador.

  if (Object.keys(erros).length || Object.keys(errosNovos).length) return { erros, errosNovos, valores: d };

  const criados = [];
  for (const a of d.novos) criados.push(await criarAprovador(a));
  const aprovadorIds = [...marcados.map((a) => a!.id), ...criados.map((a) => a.id)];
  const contrato = await salvarContrato(sistemaDoClienteId, {
    texto: d.texto,
    nivel: d.nivel,
    exigeCpf: d.exigeCpf,
    relatorioAtendimentos: d.relatorioAtendimentos,
    ativo: d.ativo,
    aprovadorIds,
  });
  await registrarAuditoria({
    autor: usuario, entidade: "contrato", entidadeId: contrato.id, rotulo: `Contrato (${sdc.sistema})`, acao: existente ? "editar" : "criar",
    mudancas: mudancasDe([
      { campo: "Texto do contrato", antes: existente?.texto, depois: d.texto },
      { campo: "Nível de comprovação", antes: existente?.nivel, depois: d.nivel },
      { campo: "Exige CPF", antes: existente?.exigeCpf, depois: d.exigeCpf },
      { campo: "Relatório de atendimentos", antes: existente?.relatorioAtendimentos, depois: d.relatorioAtendimentos },
      { campo: "Ativo", antes: existente?.ativo, depois: d.ativo },
      { campo: "Aprovadores (qtde)", antes: existente?.aprovadorIds.length, depois: aprovadorIds.length },
    ]),
  });
  revalidatePath(`/admin/clientes/${clienteId}`);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/aprovadores");
  redirect(`/admin/clientes/${clienteId}?ok=contrato`);
}
