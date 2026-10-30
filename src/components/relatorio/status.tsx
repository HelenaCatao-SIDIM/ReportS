import { CheckCircle2 } from "lucide-react";
import type { StatusRelatorio } from "@/lib/types";
import { ROTULO_STATUS_RELATORIO } from "@/lib/visitas";
import { cn } from "@/lib/utils";

const CORES: Record<StatusRelatorio, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-800",
  ajuste_solicitado: "bg-amber-100 text-amber-800",
  aprovado: "bg-emerald-100 text-emerald-800",
};

/** Status do relatório, com o rótulo de ROTULO_STATUS_RELATORIO. */
export function StatusRelatorioBadge({ status, className }: { status: StatusRelatorio; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", CORES[status], className)}>
      {status === "aprovado" && <CheckCircle2 className="size-3.5" />}
      {ROTULO_STATUS_RELATORIO[status]}
    </span>
  );
}
