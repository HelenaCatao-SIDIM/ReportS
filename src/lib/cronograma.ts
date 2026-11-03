/** Regras do cronograma de implantação, compartilhadas entre servidor e navegador. Não acessa banco. */
import { dataLocal } from "@/lib/datas";
import type { CronogramaCongelado, ItemCronograma, SituacaoCronograma, TipoVisita } from "@/lib/types";

/** Até quantos dias antes do prazo o item passa a "a vencer". */
export const DIAS_A_VENCER = 7;

export const ROTULO_SITUACAO: Record<SituacaoCronograma, string> = {
  cumprido: "Cumprido",
  cumprido_com_atraso: "Cumprido com atraso",
  no_prazo: "No prazo",
  a_vencer: "A vencer",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

/** Da mais urgente para a menos: serve para ordenar listas. */
const URGENCIA: Record<SituacaoCronograma, number> = { atrasado: 0, a_vencer: 1, no_prazo: 2, cumprido_com_atraso: 3, cumprido: 4, cancelado: 5 };
export const urgencia = (s: SituacaoCronograma) => URGENCIA[s];

/** Pendente = ainda falta fazer (inclui o atrasado). */
export const estaPendente = (s: SituacaoCronograma) => s === "atrasado" || s === "a_vencer" || s === "no_prazo";

/** Visita encerrada, no formato que o cálculo precisa. */
export interface VisitaParaCronograma {
  contratoId: string;
  unidadeId: string;
  setorId: string | null;
  tipo: TipoVisita;
  /** ISO (UTC). */
  entrada: string;
}

/** AAAA-MM-DD existente no calendário. */
export function prazoValido(prazo: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return false;
  const d = new Date(`${prazo}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === prazo;
}

/** Dias de `de` até `ate` (AAAA-MM-DD); negativo se `ate` é anterior. */
export const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** A visita cumpre o item: mesmo contrato, estabelecimento e tipo; o setor só importa se o item pede um setor. */
export const visitaCumpre = (item: ItemCronograma, v: VisitaParaCronograma) =>
  v.contratoId === item.contratoId && v.unidadeId === item.unidadeId && v.tipo === item.tipo && (item.setorId === null || v.setorId === item.setorId);

/**
 * Situação do item em `hoje` (AAAA-MM-DD, horário de Brasília). Cumpre o item a primeira visita encerrada que bate com ele;
 * se foi até o fim do dia do prazo, "cumprido", senão "cumprido com atraso". Sem visita, vale só o prazo: vencido é
 * "atrasado"; faltando até DIAS_A_VENCER dias (ou no próprio dia), "a vencer".
 */
export function calcularSituacao(
  item: ItemCronograma,
  visitasEncerradas: VisitaParaCronograma[],
  hoje: string,
): { situacao: SituacaoCronograma; cumpridoEm: string | null; diasParaPrazo: number } {
  const diasParaPrazo = diasEntre(hoje, item.prazo);
  if (item.cancelado) return { situacao: "cancelado", cumpridoEm: null, diasParaPrazo };

  const datas = visitasEncerradas.filter((v) => visitaCumpre(item, v)).map((v) => dataLocal(Date.parse(v.entrada)));
  if (datas.length) {
    const cumpridoEm = datas.reduce((a, b) => (b < a ? b : a));
    return { situacao: cumpridoEm <= item.prazo ? "cumprido" : "cumprido_com_atraso", cumpridoEm, diasParaPrazo };
  }
  const situacao: SituacaoCronograma = diasParaPrazo < 0 ? "atrasado" : diasParaPrazo <= DIAS_A_VENCER ? "a_vencer" : "no_prazo";
  return { situacao, cumpridoEm: null, diasParaPrazo };
}

/** Contagem por situação, para os cartões do painel e o resumo do relatório. */
export function contarPorSituacao(itens: { situacao: SituacaoCronograma }[]): Record<SituacaoCronograma, number> {
  const c: Record<SituacaoCronograma, number> = { cumprido: 0, cumprido_com_atraso: 0, no_prazo: 0, a_vencer: 0, atrasado: 0, cancelado: 0 };
  for (const i of itens) c[i.situacao]++;
  return c;
}

/** "faltam 3 dias", "vence hoje", "venceu há 2 dias" — para o que ainda não foi cumprido. */
export function descreverPrazo(diasParaPrazo: number): string {
  if (diasParaPrazo === 0) return "vence hoje";
  const n = Math.abs(diasParaPrazo);
  const dias = n === 1 ? "1 dia" : `${n} dias`;
  return diasParaPrazo > 0 ? `faltam ${dias}` : `venceu há ${dias}`;
}

/** O que o técnico vê no check-in: item pendente do cronograma, sem a observação interna. */
export interface PendenciaCronograma {
  contratoId: string;
  unidadeId: string;
  setorId: string | null;
  setorNome: string | null;
  tipo: TipoVisita;
  prazo: string;
  situacao: SituacaoCronograma;
  diasParaPrazo: number;
}

/** Resumo em uma frase: "3 de 5 itens cumpridos · 1 atrasado". */
export function resumoCronograma(c: CronogramaCongelado): string {
  const n = contarPorSituacao(c.itens);
  const cumpridos = n.cumprido + n.cumprido_com_atraso;
  const partes = [`${cumpridos} de ${c.itens.length} ${c.itens.length === 1 ? "item cumprido" : "itens cumpridos"}`];
  if (n.atrasado) partes.push(`${n.atrasado} ${n.atrasado === 1 ? "atrasado" : "atrasados"}`);
  return partes.join(" · ");
}
