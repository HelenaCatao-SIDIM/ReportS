/** Configuração e utilitários de visitas compartilhados entre servidor e navegador. */
import type { StatusVisita, TipoVisita } from "@/lib/types";

export const TIPOS_VISITA: { valor: TipoVisita; label: string; presencial: boolean }[] = [
  { valor: "treinamento", label: "Treinamento", presencial: true },
  { valor: "implantacao", label: "Implantação", presencial: true },
  { valor: "suporte_presencial", label: "Suporte presencial", presencial: true },
  { valor: "reuniao", label: "Reunião", presencial: true },
  { valor: "visita_tecnica", label: "Visita técnica", presencial: true },
  { valor: "treinamento_online", label: "Treinamento online", presencial: false },
  { valor: "analise_ambiente", label: "Análise de ambiente", presencial: true },
];

/** Quem a visita atendeu, numa linha: as equipes treinadas ("Médica, Enfermagem"). */
export const rotuloAtendidos = (v: { equipes?: string[] }) => (v.equipes ?? []).join(", ") || "—";

/** Rótulo do campo de {@link rotuloAtendidos}. */
export const tituloAtendidos = () => "Equipes";

/** Fotos da lista de presença em papel (lançamento retroativo), que ficam junto das fotos extras. */
export const fotosDaLista = <F extends { legenda?: string }>(v: { fotosExtras: F[] }): F[] => v.fotosExtras.filter((f) => f.legenda === "lista_presenca");

export const rotuloTipo = (t: TipoVisita) => TIPOS_VISITA.find((x) => x.valor === t)?.label ?? t;
export const ehPresencial = (t: TipoVisita) => TIPOS_VISITA.find((x) => x.valor === t)?.presencial ?? true;

export const ROTULO_STATUS: Record<StatusVisita, string> = {
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export const ROTULO_STATUS_RELATORIO = {
  rascunho: "Rascunho",
  emitido: "Emitido",
  enviado: "Enviado",
  ajuste_solicitado: "Ajuste solicitado",
  aprovado: "Aprovado",
} as const;

/** 135 → "2h 15min" */
export function formatarMinutos(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}min` : ""}` : `${m}min`;
}

/** "2026-10-01" → "01/10/2026" */
export const formatarDataCurta = (data: string) => data.split("-").reverse().join("/");
