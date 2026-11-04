import "server-only";
import { idPlataforma, reports } from "@/lib/db";
import { calcularSituacao, estaPendente, urgencia, type VisitaParaCronograma } from "@/lib/cronograma";
import type { CronogramaCongelado, ItemCronograma, ItemCronogramaComSituacao, TipoVisita } from "@/lib/types";

/*
 * Cronograma de implantação — banco do ReportS. Um item é de um contrato e pede uma atividade (tipo de visita) num
 * estabelecimento, ou num setor dele, até um prazo. A situação nunca é gravada: sai das visitas encerradas do contrato.
 */

const INCLUIR = { estabelecimento: { select: { nome: true } }, setor: { select: { nome: true } } } as const;

type Linha = Awaited<ReturnType<typeof reports.itemCronograma.findFirstOrThrow<{ include: typeof INCLUIR }>>>;

const paraItem = (l: Linha): ItemCronograma & { unidadeNome: string; setorNome: string | null } => ({
  id: l.id,
  clienteId: l.clienteId.toString(),
  contratoId: l.contratoId,
  unidadeId: l.estabelecimentoId,
  setorId: l.setorId,
  tipo: l.tipo as TipoVisita,
  prazo: l.prazo.toISOString().slice(0, 10),
  observacao: l.observacao,
  cancelado: l.cancelado,
  unidadeNome: l.estabelecimento.nome,
  setorNome: l.setor?.nome ?? null,
});

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
          select: { contratoId: true, estabelecimentoId: true, setorId: true, tipo: true, entrada: true },
        })
      ).map((v) => ({ contratoId: v.contratoId, unidadeId: v.estabelecimentoId, setorId: v.setorId, tipo: v.tipo as TipoVisita, entrada: v.entrada.toISOString() }))
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
  setorId: string | null;
  tipo: TipoVisita;
  prazo: string;
  observacao: string;
}

/** Já existe item ativo igual (mesmo contrato, estabelecimento, setor e atividade)? */
export async function itemCronogramaDuplicado(d: Pick<DadosItemCronograma, "contratoId" | "unidadeId" | "setorId" | "tipo">, excetoId?: string) {
  return (
    (await reports.itemCronograma.count({
      where: { contratoId: d.contratoId, estabelecimentoId: d.unidadeId, setorId: d.setorId, tipo: d.tipo, cancelado: false, ...(excetoId ? { id: { not: excetoId } } : {}) },
    })) > 0
  );
}

/** Cria o item. O cliente vem do contrato (ficam copiados no item, como na visita). */
export async function criarItemCronograma(d: DadosItemCronograma): Promise<void> {
  const contrato = await reports.contrato.findUniqueOrThrow({ where: { id: d.contratoId }, select: { clienteId: true } });
  await reports.itemCronograma.create({
    data: {
      id: crypto.randomUUID(),
      clienteId: contrato.clienteId,
      contratoId: d.contratoId,
      estabelecimentoId: d.unidadeId,
      setorId: d.setorId,
      tipo: d.tipo,
      prazo: new Date(`${d.prazo}T00:00:00Z`),
      observacao: d.observacao,
    },
  });
}

/** Edita o item. O contrato não muda: para outro contrato, cancele e crie outro. */
export async function atualizarItemCronograma(id: string, d: Omit<DadosItemCronograma, "contratoId">): Promise<void> {
  await reports.itemCronograma.updateMany({
    where: { id },
    data: { estabelecimentoId: d.unidadeId, setorId: d.setorId, tipo: d.tipo, prazo: new Date(`${d.prazo}T00:00:00Z`), observacao: d.observacao },
  });
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
    itens: itens.map((i) => ({ unidadeNome: i.unidadeNome, setorNome: i.setorNome, tipo: i.tipo, prazo: i.prazo, situacao: i.situacao, cumpridoEm: i.cumpridoEm })),
  };
}
