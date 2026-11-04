"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { prazoValido } from "@/lib/cronograma";
import { TIPOS_VISITA } from "@/lib/visitas";
import { buscarSetor, buscarUnidade } from "@/lib/repo/clientes";
import { buscarContrato } from "@/lib/repo/contratos";
import {
  atualizarItemCronograma,
  buscarItemCronograma,
  criarItemCronograma,
  definirItemCronogramaCancelado,
  itemCronogramaDuplicado,
} from "@/lib/repo/cronograma";
import type { TipoVisita } from "@/lib/types";

const LIMITE_OBSERVACAO = 500;

type Campos = "contratoId" | "unidadeId" | "setorId" | "tipo" | "prazo" | "observacao";

export interface ItemFormState {
  ok?: boolean;
  erros?: Partial<Record<Campos | "geral", string>>;
  valores?: Record<Campos, string>;
}

/** Cria (itemId null) ou edita um item do cronograma. O contrato de um item existente não muda. */
export async function salvarItemCronograma(itemId: string | null, _: ItemFormState, fd: FormData): Promise<ItemFormState> {
  await exigirPermissaoAcao(PERMISSOES.contratosGerenciar);
  const existente = itemId ? await buscarItemCronograma(itemId) : null;
  if (itemId && !existente) return { erros: { geral: "Este item não existe mais." } };

  const d: Record<Campos, string> = {
    contratoId: existente?.contratoId ?? String(fd.get("contratoId") ?? ""),
    unidadeId: String(fd.get("unidadeId") ?? ""),
    setorId: String(fd.get("setorId") ?? ""),
    tipo: String(fd.get("tipo") ?? ""),
    prazo: String(fd.get("prazo") ?? ""),
    observacao: String(fd.get("observacao") ?? "").trim(),
  };

  const erros: NonNullable<ItemFormState["erros"]> = {};
  const contrato = d.contratoId ? await buscarContrato(d.contratoId) : null;
  if (!contrato) erros.contratoId = "Escolha o contrato.";
  else if (!existente && (!contrato.ativo || !contrato.clienteAtivo)) erros.contratoId = "Este contrato está inativo.";

  const unidade = d.unidadeId ? await buscarUnidade(d.unidadeId) : null;
  if (!unidade || (contrato && unidade.clienteId !== contrato.clienteId)) erros.unidadeId = "Escolha um estabelecimento do cliente.";

  if (d.setorId) {
    const setor = await buscarSetor(d.setorId);
    if (!setor || setor.unidadeId !== d.unidadeId) erros.setorId = "Escolha um setor do estabelecimento.";
  }
  if (!TIPOS_VISITA.some((t) => t.valor === d.tipo)) erros.tipo = "Escolha a atividade.";
  if (!prazoValido(d.prazo)) erros.prazo = "Informe o prazo.";
  if (d.observacao.length > LIMITE_OBSERVACAO) erros.observacao = `Use no máximo ${LIMITE_OBSERVACAO} caracteres.`;

  if (!Object.keys(erros).length) {
    const igual = { contratoId: d.contratoId, unidadeId: d.unidadeId, setorId: d.setorId || null, tipo: d.tipo as TipoVisita };
    if (await itemCronogramaDuplicado(igual, itemId ?? undefined)) erros.geral = "Já existe um item ativo igual: mesmo contrato, estabelecimento, setor e atividade.";
  }
  if (Object.keys(erros).length) return { erros, valores: d };

  const dados = { unidadeId: d.unidadeId, setorId: d.setorId || null, tipo: d.tipo as TipoVisita, prazo: d.prazo, observacao: d.observacao };
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
