"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { LIMITE_HORARIO, prazoValido } from "@/lib/cronograma";
import { TIPOS_VISITA } from "@/lib/visitas";
import { buscarUnidade } from "@/lib/repo/clientes";
import { buscarContrato } from "@/lib/repo/contratos";
import { listarEquipes } from "@/lib/repo/equipes";
import {
  atualizarItemCronograma,
  buscarItemCronograma,
  criarItemCronograma,
  definirItemCronogramaCancelado,
  itemCronogramaDuplicado,
} from "@/lib/repo/cronograma";
import type { TipoVisita } from "@/lib/types";

const LIMITE_OBSERVACAO = 500;

type Campos = "contratoId" | "unidadeId" | "tipo" | "prazo" | "horario" | "observacao";

export interface ItemFormState {
  ok?: boolean;
  erros?: Partial<Record<Campos | "equipeIds" | "geral", string>>;
  valores?: Record<Campos, string> & { equipeIds: string[] };
}

/** Cria (itemId null) ou edita um item do cronograma. O contrato de um item existente não muda. */
export async function salvarItemCronograma(itemId: string | null, _: ItemFormState, fd: FormData): Promise<ItemFormState> {
  await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const existente = itemId ? await buscarItemCronograma(itemId) : null;
  if (itemId && !existente) return { erros: { geral: "Este item não existe mais." } };

  const d = {
    contratoId: existente?.contratoId ?? String(fd.get("contratoId") ?? ""),
    unidadeId: String(fd.get("unidadeId") ?? ""),
    tipo: String(fd.get("tipo") ?? ""),
    prazo: String(fd.get("prazo") ?? ""),
    horario: String(fd.get("horario") ?? "").trim(),
    observacao: String(fd.get("observacao") ?? "").trim(),
    equipeIds: [...new Set(fd.getAll("equipeIds").map(String))],
  };

  const erros: NonNullable<ItemFormState["erros"]> = {};
  const contrato = d.contratoId ? await buscarContrato(d.contratoId) : null;
  if (!contrato) erros.contratoId = "Escolha o contrato.";
  else if (!existente && (!contrato.ativo || !contrato.clienteAtivo)) erros.contratoId = "Este contrato está inativo.";

  const unidade = d.unidadeId ? await buscarUnidade(d.unidadeId) : null;
  if (!unidade || (contrato && unidade.clienteId !== contrato.clienteId)) erros.unidadeId = "Escolha um estabelecimento do cliente.";

  // Equipes ativas, mais as que o item já tinha (uma equipe inativada depois continua aceita).
  const jaTinha = new Set(existente?.equipeIds ?? []);
  const validas = new Set((await listarEquipes()).filter((e) => e.ativo || jaTinha.has(e.id)).map((e) => e.id));
  if (d.equipeIds.some((id) => !validas.has(id))) erros.equipeIds = "Escolha apenas equipes da lista.";

  if (!TIPOS_VISITA.some((t) => t.valor === d.tipo)) erros.tipo = "Escolha a atividade.";
  if (!prazoValido(d.prazo)) erros.prazo = "Informe o prazo.";
  if (d.horario.length > LIMITE_HORARIO) erros.horario = `Use no máximo ${LIMITE_HORARIO} caracteres.`;
  if (d.observacao.length > LIMITE_OBSERVACAO) erros.observacao = `Use no máximo ${LIMITE_OBSERVACAO} caracteres.`;

  if (!Object.keys(erros).length) {
    const igual = { contratoId: d.contratoId, unidadeId: d.unidadeId, equipeIds: d.equipeIds, tipo: d.tipo as TipoVisita, prazo: d.prazo };
    if (await itemCronogramaDuplicado(igual, itemId ?? undefined)) erros.geral = "Já existe um item ativo igual: mesmo contrato, estabelecimento, atividade, equipes e prazo.";
  }
  if (Object.keys(erros).length) return { erros, valores: d };

  const dados = { unidadeId: d.unidadeId, equipeIds: d.equipeIds, tipo: d.tipo as TipoVisita, prazo: d.prazo, horario: d.horario, observacao: d.observacao };
  if (itemId) await atualizarItemCronograma(itemId, dados);
  else await criarItemCronograma({ ...dados, contratoId: d.contratoId });
  revalidatePath("/admin/cronograma");
  return { ok: true };
}

/** Cancela ou reativa o item. O cancelado deixa de contar e de aparecer ao técnico e ao cliente. */
export async function alternarItemCronograma(id: string, cancelado: boolean) {
  await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  await definirItemCronogramaCancelado(id, cancelado);
  revalidatePath("/admin/cronograma");
}
