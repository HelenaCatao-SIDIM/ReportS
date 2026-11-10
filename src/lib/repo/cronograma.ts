import "server-only";
import { idPlataforma, reports } from "@/lib/db";
import { calcularSituacao, estaPendente, mesmasEquipes, urgencia, type VisitaParaCronograma } from "@/lib/cronograma";
import type { CronogramaCongelado, ItemCronograma, ItemCronogramaComSituacao, TipoVisita } from "@/lib/types";

/*
 * Cronograma de implantação — banco do ReportS. Um item é de um contrato e pede uma atividade (tipo de visita) num
 * estabelecimento, para algumas equipes, até um prazo. A situação nunca é gravada: sai das visitas encerradas do contrato.
 * A coluna setor_id é legado (o cronograma usava setor antes das equipes) e não é mais lida.
 */

const INCLUIR = {
  estabelecimento: { select: { nome: true } },
  equipes: { select: { equipeId: true, equipe: { select: { nome: true } } } },
} as const;

type Linha = Awaited<ReturnType<typeof reports.itemCronograma.findFirstOrThrow<{ include: typeof INCLUIR }>>>;

const paraItem = (l: Linha): ItemCronograma & { unidadeNome: string; equipeNomes: string[] } => {
  const equipes = [...l.equipes].sort((a, b) => a.equipe.nome.localeCompare(b.equipe.nome, "pt-BR"));
  return {
    id: l.id,
    clienteId: l.clienteId.toString(),
    contratoId: l.contratoId,
    unidadeId: l.estabelecimentoId,
    equipeIds: equipes.map((e) => e.equipeId),
    tipo: l.tipo as TipoVisita,
    prazo: l.prazo.toISOString().slice(0, 10),
    observacao: l.observacao,
    cancelado: l.cancelado,
    unidadeNome: l.estabelecimento.nome,
    equipeNomes: equipes.map((e) => e.equipe.nome),
  };
};

type ItemComNomes = ReturnType<typeof paraItem>;

/** Calcula a situação de vários itens com uma consulta às visitas encerradas dos contratos envolvidos. */
async function comSituacao(itens: ItemComNomes[], hoje: string): Promise<ItemCronogramaComSituacao[]> {
  const ativos = itens.filter((i) => !i.cancelado);
  const visitas: VisitaParaCronograma[] = ativos.length
    ? (
        await reports.visita.findMany({
          where: {
            status: "encerrada",
            contratoId: { in: [...new Set(ativos.map((i) => i.contratoId))] },
            estabelecimentoId: { in: [...new Set(ativos.map((i) => i.unidadeId))] },
            tipo: { in: [...new Set(ativos.map((i) => i.tipo))] },
          },
          select: { contratoId: true, estabelecimentoId: true, tipo: true, entrada: true, equipes: { select: { equipeId: true } } },
        })
      ).map((v) => ({
        contratoId: v.contratoId,
        unidadeId: v.estabelecimentoId,
        equipeIds: v.equipes.map((e) => e.equipeId),
        tipo: v.tipo as TipoVisita,
        entrada: v.entrada.toISOString(),
      }))
    : [];
  return itens
    .map((i) => ({ ...i, ...calcularSituacao(i, visitas, hoje) }))
    .sort((a, b) => urgencia(a.situacao) - urgencia(b.situacao) || a.prazo.localeCompare(b.prazo) || a.unidadeNome.localeCompare(b.unidadeNome, "pt-BR"));
}

export interface FiltroCronograma {
  clienteId?: string;
  contratoId?: string;
  unidadeId?: string;
}

/** Itens com a situação de `hoje` (AAAA-MM-DD, horário de Brasília), dos mais urgentes aos menos. */
export async function listarCronograma(hoje: string, f: FiltroCronograma = {}): Promise<ItemCronogramaComSituacao[]> {
  const cliente = f.clienteId ? idPlataforma(f.clienteId) : undefined;
  if (cliente === null) return [];
  const linhas = await reports.itemCronograma.findMany({
    where: { ...(cliente ? { clienteId: cliente } : {}), ...(f.contratoId ? { contratoId: f.contratoId } : {}), ...(f.unidadeId ? { estabelecimentoId: f.unidadeId } : {}) },
    include: INCLUIR,
  });
  return comSituacao(linhas.map(paraItem), hoje);
}

export async function buscarItemCronograma(id: string): Promise<ItemCronograma | null> {
  const l = await reports.itemCronograma.findUnique({ where: { id }, include: INCLUIR });
  return l ? paraItem(l) : null;
}

export interface DadosItemCronograma {
  contratoId: string;
  unidadeId: string;
  equipeIds: string[];
  tipo: TipoVisita;
  prazo: string;
  observacao: string;
}

/** Já existe item ativo igual (mesmo contrato, estabelecimento, atividade e equipes)? */
export async function itemCronogramaDuplicado(d: Pick<DadosItemCronograma, "contratoId" | "unidadeId" | "equipeIds" | "tipo">, excetoId?: string) {
  const candidatos = await reports.itemCronograma.findMany({
    where: { contratoId: d.contratoId, estabelecimentoId: d.unidadeId, tipo: d.tipo, cancelado: false, ...(excetoId ? { id: { not: excetoId } } : {}) },
    select: { equipes: { select: { equipeId: true } } },
  });
  return candidatos.some((c) => mesmasEquipes(c.equipes.map((e) => e.equipeId), d.equipeIds));
}

/** Cria o item. O cliente vem do contrato (fica copiado no item, como na visita). */
export async function criarItemCronograma(d: DadosItemCronograma): Promise<void> {
  const contrato = await reports.contrato.findUniqueOrThrow({ where: { id: d.contratoId }, select: { clienteId: true } });
  await reports.itemCronograma.create({
    data: {
      id: crypto.randomUUID(),
      clienteId: contrato.clienteId,
      contratoId: d.contratoId,
      estabelecimentoId: d.unidadeId,
      tipo: d.tipo,
      prazo: new Date(`${d.prazo}T00:00:00Z`),
      observacao: d.observacao,
      equipes: { create: [...new Set(d.equipeIds)].map((equipeId) => ({ equipeId })) },
    },
  });
}

/** Edita o item. O contrato não muda: para outro contrato, cancele e crie outro. */
export async function atualizarItemCronograma(id: string, d: Omit<DadosItemCronograma, "contratoId">): Promise<void> {
  await reports.$transaction([
    reports.itemCronograma.updateMany({
      where: { id },
      data: { estabelecimentoId: d.unidadeId, tipo: d.tipo, prazo: new Date(`${d.prazo}T00:00:00Z`), observacao: d.observacao },
    }),
    reports.itemCronogramaEquipe.deleteMany({ where: { itemId: id } }),
    reports.itemCronogramaEquipe.createMany({ data: [...new Set(d.equipeIds)].map((equipeId) => ({ itemId: id, equipeId })) }),
  ]);
}

export async function definirItemCronogramaCancelado(id: string, cancelado: boolean): Promise<void> {
  await reports.itemCronograma.updateMany({ where: { id }, data: { cancelado } });
}

/** Itens que ainda faltam fazer (atrasados, a vencer e no prazo) dos contratos, para o técnico no check-in. */
export async function listarPendentesDosContratos(contratoIds: string[], hoje: string): Promise<ItemCronogramaComSituacao[]> {
  if (!contratoIds.length) return [];
  const linhas = await reports.itemCronograma.findMany({ where: { contratoId: { in: contratoIds }, cancelado: false }, include: INCLUIR });
  return (await comSituacao(linhas.map(paraItem), hoje)).filter((i) => estaPendente(i.situacao));
}

/**
 * Cronograma do contrato como vai para o relatório do cliente: sem observação interna e sem os itens cancelados.
 * Nulo quando o contrato não tem cronograma.
 */
export async function congelarCronograma(contratoId: string, hoje: string): Promise<CronogramaCongelado | null> {
  const itens = (await listarCronograma(hoje, { contratoId })).filter((i) => i.situacao !== "cancelado");
  if (!itens.length) return null;
  return {
    em: hoje,
    itens: itens.map((i) => ({ unidadeNome: i.unidadeNome, equipes: i.equipeNomes, tipo: i.tipo, prazo: i.prazo, situacao: i.situacao, cumpridoEm: i.cumpridoEm })),
  };
}
