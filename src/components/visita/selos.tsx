import { Lock } from "lucide-react";
import type { VisitaDetalhada } from "@/lib/repo/visitas";
import { Badge } from "@/components/ui/badge";

/** Selos de situação da visita: em andamento/encerrada/cancelada, encerrada pelo gestor, corrigida, travada. */
export function SelosVisita({ visita }: { visita: Pick<VisitaDetalhada, "status" | "encerradaPorGestor" | "historico" | "travada"> }) {
  const corrigida = visita.historico.some((h) => h.acao === "correcao");
  return (
    <span className="inline-flex flex-wrap gap-1">
      {visita.status === "em_andamento" && <Badge>Em andamento</Badge>}
      {visita.status === "encerrada" && <Badge variant="outline">Encerrada</Badge>}
      {visita.status === "cancelada" && <Badge variant="destructive">Cancelada</Badge>}
      {visita.encerradaPorGestor && <Badge variant="secondary">Encerrada pelo gestor</Badge>}
      {corrigida && <Badge variant="secondary">Corrigida</Badge>}
      {visita.travada && (
        <Badge variant="secondary">
          <Lock />
          Relatório aprovado
        </Badge>
      )}
    </span>
  );
}
