import type { ChamadoSuporte, ResumoSuporte } from "@/lib/types";

/*
 * Cálculos e textos dos atendimentos do suporte no relatório (painel de indicadores, "por tabulação" e lista analítica).
 * Compartilhado entre o servidor (PDF) e o navegador. Não acessa banco. As datas vêm do Fortics como texto, já no horário de
 * Brasília ("2026-10-05 09:10:00" ou "2026-10-05T09:10:00.000000Z", em que o "Z" não é UTC de verdade).
 */

const DATA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** Dia ("05/10/2026"), data ("2026-10-05") e hora ("09:10") do texto do Fortics; null se não for uma data. */
export function partesDaData(s: string): { dia: string; data: string; hora: string } | null {
  const m = DATA.exec(s ?? "");
  return m ? { dia: `${m[3]}/${m[2]}/${m[1]}`, data: `${m[1]}-${m[2]}-${m[3]}`, hora: `${m[4]}:${m[5]}` } : null;
}

const instante = (s: string) => {
  const m = DATA.exec(s ?? "");
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], Number(m[6] ?? 0)) : null;
};

/** Minutos entre a abertura e o encerramento, ou null se faltar uma das datas ou o encerramento for antes da abertura. */
export function minutosEntre(abertura: string, encerramento: string): number | null {
  const a = instante(abertura);
  const e = instante(encerramento);
  return a === null || e === null || e < a ? null : Math.round((e - a) / 60000);
}

/**
 * Tempo dedicado ao atendimento (TMA): o que o n8n mandou; null se ele não trouxe (`semTempo`).
 * Só os resumos guardados antes de 06/11/2026, sem a marca `semTempo`, seguem com o encerramento menos a abertura (o que já foi enviado não muda).
 */
export function duracaoDoChamado(c: Pick<ChamadoSuporte, "abertura" | "encerramento" | "duracaoMin" | "semTempo">): number | null {
  if (typeof c.duracaoMin === "number" && Number.isFinite(c.duracaoMin) && c.duracaoMin >= 0) return c.duracaoMin;
  if (c.semTempo) return null;
  return minutosEntre(c.abertura, c.encerramento);
}

/** Do mais antigo ao mais recente (sem mudar o original). */
export const ordenarPorAbertura = (chamados: ChamadoSuporte[]) => [...chamados].sort((a, b) => (instante(a.abertura) ?? 0) - (instante(b.abertura) ?? 0));

/** "9,3 min", "22 min", "1h05min", "19h48min". */
export function formatarTempo(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  if (min < 60) return `${(Math.round(min * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
  const total = Math.round(min);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}min`;
}

export interface Indicadores {
  total: number;
  esperaMediaMin: number | null;
  atendimentoMedioMin: number | null;
  tempoTotalMin: number | null;
}

/** Os quatro números do painel. Atendimento médio e tempo total saem da lista de chamados (só os que têm tempo). */
export function indicadores(r: Pick<ResumoSuporte, "totalAbertosEFechados" | "tempoMedioEsperaMin" | "chamados">): Indicadores {
  const tempos = r.chamados.map(duracaoDoChamado).filter((t): t is number => t !== null);
  const soma = tempos.reduce((s, t) => s + t, 0);
  return {
    total: r.totalAbertosEFechados,
    esperaMediaMin: r.tempoMedioEsperaMin,
    atendimentoMedioMin: tempos.length ? Math.round(soma / tempos.length) : null,
    tempoTotalMin: tempos.length ? soma : null,
  };
}

export interface LinhaTabulacao {
  nome: string;
  quantidade: number;
  /** Porcentagem do total, inteira. */
  percentual: number;
  /** "Outros" e atendimentos sem tabulação: a barra sai em cinza. */
  neutra: boolean;
}

const NEUTRAS = new Set(["outros", "nao informado", "encerrado sem tabulacao"]);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "Por tabulação" (o motivo de encerramento): as maiores e o resto somado em "Outros". */
export function tabulacoes(r: Pick<ResumoSuporte, "totalAbertosEFechados" | "porMotivoEncerramento">, maximo = 7): LinhaTabulacao[] {
  const lista = r.porMotivoEncerramento;
  const base = lista.length > maximo ? lista.slice(0, maximo - 1) : lista;
  const resto = lista.length > maximo ? lista.slice(maximo - 1).reduce((s, x) => s + x.quantidade, 0) : 0;
  const todas = resto ? [...base, { nome: "Outros", quantidade: resto }] : base;
  const total = r.totalAbertosEFechados || 1;
  return todas.map((x) => ({ nome: x.nome, quantidade: x.quantidade, percentual: Math.round((x.quantidade / total) * 100), neutra: NEUTRAS.has(semAcento(x.nome)) }));
}

export interface LinhaAtendimento {
  dia: string;
  /** "09:10 – 09:45"; se terminar em outro dia, "09:10 – 06/10 08:15". */
  horario: string;
  tempo: string;
  solicitante: string;
  tecnico: string;
  assunto: string;
  tabulacao: string;
}

/** Uma linha da lista analítica. Campo que o Fortics não trouxe sai como "—". */
export function linhaDoAtendimento(c: ChamadoSuporte): LinhaAtendimento {
  const ini = partesDaData(c.abertura);
  const fim = partesDaData(c.encerramento);
  const horario = ini ? `${ini.hora} – ${fim ? (fim.data === ini.data ? fim.hora : `${fim.dia.slice(0, 5)} ${fim.hora}`) : "—"}` : "—";
  return {
    dia: ini?.dia ?? "—",
    horario,
    tempo: formatarTempo(duracaoDoChamado(c)),
    solicitante: c.solicitante?.trim() || "—",
    tecnico: c.agente?.trim() || "—",
    assunto: c.topico?.trim() || "—",
    tabulacao: c.motivoEncerramento?.trim() || "—",
  };
}
