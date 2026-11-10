/** Regras do cronograma de implantação, compartilhadas entre servidor e navegador. Não acessa banco. */
import { dataLocal } from "@/lib/datas";
import type { CronogramaCongelado, ItemCronograma, SituacaoCronograma, TipoVisita } from "@/lib/types";

/** Até quantos dias antes do prazo o item passa a "a vencer". */
/** Tamanho máximo do horário do item (texto livre, opcional). */
export const LIMITE_HORARIO = 60;

export const DIAS_A_VENCER = 7;

export const ROTULO_SITUACAO: Record<SituacaoCronograma, string> = {
  cumprido: "Cumprido",
  cumprido_com_atraso: "Cumprido com atraso",
  no_prazo: "No prazo",
  a_vencer: "A vencer",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

/**
 * Como o CLIENTE lê a situação (relatório, PDF e página do aprovador): sem ressaltar atraso, em favor da SIDIM.
 * "Cumprido com atraso" vira só "Cumprido" (a data em que foi cumprido fica embaixo) e "Atrasado" vira "Pendente".
 * A Administração e o técnico seguem vendo a situação exata. A situação gravada no relatório emitido não muda: a troca é só
 * na hora de mostrar (então vale também para os relatórios já emitidos).
 */
export type SituacaoNoRelatorio = "cumprido" | "pendente" | "no_prazo" | "a_vencer" | "cancelado";

export const situacaoNoRelatorio = (s: SituacaoCronograma): SituacaoNoRelatorio => (s === "cumprido_com_atraso" ? "cumprido" : s === "atrasado" ? "pendente" : s);

export const ROTULO_SITUACAO_RELATORIO: Record<SituacaoNoRelatorio, string> = {
  cumprido: "Cumprido",
  pendente: "Pendente",
  no_prazo: "No prazo",
  a_vencer: "A vencer",
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
  /** Equipes marcadas como treinadas na visita. */
  equipeIds: string[];
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

/**
 * A visita cumpre o item: mesmo contrato, estabelecimento e tipo, e treinou **todas** as equipes que o item pede (pode ter
 * treinado outras também). Item sem equipe: qualquer visita do tipo no estabelecimento cumpre.
 */
export const visitaCumpre = (item: ItemCronograma, v: VisitaParaCronograma) =>
  v.contratoId === item.contratoId &&
  v.unidadeId === item.unidadeId &&
  v.tipo === item.tipo &&
  item.equipeIds.every((id) => v.equipeIds.includes(id));

/** Mesmas equipes, sem importar a ordem nem repetição (para achar item repetido). */
export const mesmasEquipes = (a: string[], b: string[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((id) => y.has(id));
};

/**
 * Quem o item pede, em texto: as equipes; sem equipe, "Todas as equipes". Nas versões de relatório emitidas antes das
 * equipes no cronograma, o setor que o item tinha.
 */
export function equipesDoItem(i: { equipes?: string[]; equipeNomes?: string[]; setorNome?: string | null }): string {
  const nomes = i.equipes ?? i.equipeNomes;
  if (nomes) return nomes.length ? nomes.join(", ") : "Todas as equipes";
  return i.setorNome ? `Setor ${i.setorNome}` : "Todas as equipes";
}

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

type Situacao = ReturnType<typeof calcularSituacao>;

/**
 * Situação de vários itens de uma vez (na ordem recebida). Itens iguais em dias diferentes (mesmo contrato,
 * estabelecimento, atividade e equipes) não usam a mesma visita: cada visita cumpre **um** deles, o de prazo mais cedo
 * ainda em aberto, e as visitas vão sendo usadas da mais antiga para a mais nova. Assim, os 4 dias de treinamento da
 * equipe médica precisam de 4 visitas. Itens com equipes diferentes podem ser cumpridos pela mesma visita.
 * Precisa receber todos os itens que disputam as visitas (todos os do contrato, ou do estabelecimento).
 */
export function calcularSituacoes(itens: ItemCronograma[], visitasEncerradas: VisitaParaCronograma[], hoje: string): Situacao[] {
  const visitas = visitasEncerradas.map((v, n) => ({ v, n, t: Date.parse(v.entrada) })).sort((a, b) => a.t - b.t || a.n - b.n);
  const usadas = new Set<string>();
  const visitaDoItem = new Map<number, VisitaParaCronograma>();
  const ordem = itens
    .map((item, n) => ({ item, n }))
    .filter((x) => !x.item.cancelado)
    .sort((a, b) => a.item.prazo.localeCompare(b.item.prazo) || a.item.id.localeCompare(b.item.id));
  for (const { item, n } of ordem) {
    const grupo = [...new Set(item.equipeIds)].sort().join(",");
    const achou = visitas.find((x) => !usadas.has(`${x.n}|${grupo}`) && visitaCumpre(item, x.v));
    if (!achou) continue;
    usadas.add(`${achou.n}|${grupo}`);
    visitaDoItem.set(n, achou.v);
  }
  return itens.map((item, n) => calcularSituacao(item, visitaDoItem.has(n) ? [visitaDoItem.get(n)!] : [], hoje));
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
  equipeNomes: string[];
  tipo: TipoVisita;
  prazo: string;
  situacao: SituacaoCronograma;
  diasParaPrazo: number;
}

/** Resumo em uma frase, para o cliente: "3 de 5 itens cumpridos". Não conta nem cita atrasos (ver `situacaoNoRelatorio`). */
export function resumoCronograma(c: CronogramaCongelado): string {
  const n = contarPorSituacao(c.itens);
  const cumpridos = n.cumprido + n.cumprido_com_atraso;
  return `${cumpridos} de ${c.itens.length} ${c.itens.length === 1 ? "item cumprido" : "itens cumpridos"}`;
}
