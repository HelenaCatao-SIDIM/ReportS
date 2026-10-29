import { Lock, MapPinCheck, MapPinOff } from "lucide-react";
import type { VisitaDetalhada } from "@/lib/repo/visitas";
import { dentroDoRaio, foraDoRaio } from "@/lib/distancia";
import { Badge } from "@/components/ui/badge";

/**
 * Selos de situação da visita: em andamento/encerrada/cancelada, encerrada pela administração, corrigida, travada.
 * `alertaRaio` (só na Administração) acrescenta o selo de check-in dentro ou fora do raio do estabelecimento.
 */
export function SelosVisita({
  visita,
  alertaRaio = false,
}: {
  visita: Pick<VisitaDetalhada, "status" | "encerradaPelaAdministracao" | "historico" | "travada" | "distanciaCheckinM" | "raioCheckinM">;
  alertaRaio?: boolean;
}) {
  const corrigida = visita.historico.some((h) => h.acao === "correcao");
  return (
    <span className="inline-flex flex-wrap gap-1">
      {visita.status === "em_andamento" && <Badge>Em andamento</Badge>}
      {visita.status === "encerrada" && <Badge variant="outline">Encerrada</Badge>}
      {visita.status === "cancelada" && <Badge variant="destructive">Cancelada</Badge>}
      {visita.encerradaPelaAdministracao && <Badge variant="secondary">Encerrada pela administração</Badge>}
      {corrigida && <Badge variant="secondary">Corrigida</Badge>}
      {alertaRaio && dentroDoRaio(visita) && (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
          <MapPinCheck />
          Dentro do raio
        </Badge>
      )}
      {alertaRaio && foraDoRaio(visita) && (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          <MapPinOff />
          Fora do raio
        </Badge>
      )}
      {visita.travada && (
        <Badge variant="secondary">
          <Lock />
          Relatório aprovado
        </Badge>
      )}
    </span>
  );
}
