import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoParticipante } from "@/lib/types";

export const ROTULO_PARTICIPANTE: Record<EstadoParticipante, string> = {
  confirmado: "Confirmado pelo ERP",
  provisorio: "Provisório",
};

const DICA: Record<EstadoParticipante, string> = {
  confirmado: "Veio do ERP (tem o id do usuário no ERP). O nome é do ERP.",
  provisorio: "Cadastrado no ReportS, sem o id do ERP.",
};

/** Selo de estado do participante. Só na Administração e no App do Técnico: o aprovador e o PDF mostram apenas o nome. */
export function SeloParticipante({ estado, className }: { estado: EstadoParticipante; className?: string }) {
  return (
    <Badge
      variant="outline"
      title={DICA[estado]}
      className={cn(estado === "confirmado" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900", className)}
    >
      {ROTULO_PARTICIPANTE[estado]}
    </Badge>
  );
}
