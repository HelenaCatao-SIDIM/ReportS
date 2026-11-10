/** Configuração e utilitários de visitas compartilhados entre servidor e navegador. */
import type { StatusVisita, TipoVisita } from "@/lib/types";

export const TIPOS_VISITA: { valor: TipoVisita; label: string; presencial: boolean }[] = [
  { valor: "treinamento", label: "Treinamento", presencial: true },
  { valor: "implantacao", label: "Implantação", presencial: true },
  { valor: "suporte_presencial", label: "Suporte presencial", presencial: true },
  { valor: "reuniao", label: "Reunião", presencial: true },
  { valor: "visita_tecnica", label: "Visita técnica", presencial: true },
  { valor: "treinamento_online", label: "Treinamento online", presencial: false },
];

/** Nomes dos setores da visita: o do check-in e os acrescentados depois, sem repetir nem contar o "—" de quem não tem setor. */
export function nomesDosSetores(v: { setorNome: string; setoresExtras?: { nome: string }[] }): string[] {
  const vistos = new Set<string>();
  return [v.setorNome, ...(v.setoresExtras ?? []).map((s) => s.nome)].filter((n) => {
    const k = n.trim().toLowerCase();
    if (!k || k === "—" || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Quem a visita atendeu, numa linha: os setores ("Protocolo, Recursos Humanos") nas visitas antigas, que tinham setor; nas
 * novas, as equipes ("Médica, Enfermagem"), que tomaram o lugar do setor no check-in.
 */
export const rotuloAtendidos = (v: { setorNome: string; setoresExtras?: { nome: string }[]; equipes?: string[] }) =>
  nomesDosSetores(v).join(", ") || (v.equipes ?? []).join(", ") || "—";

/** Rótulo do campo de {@link rotuloAtendidos}: "Setor", "Setores" ou "Equipes". */
export const tituloAtendidos = (v: { setorNome: string; setoresExtras?: { nome: string }[] }) => {
  const n = nomesDosSetores(v).length;
  return n > 1 ? "Setores" : n === 1 ? "Setor" : "Equipes";
};

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
