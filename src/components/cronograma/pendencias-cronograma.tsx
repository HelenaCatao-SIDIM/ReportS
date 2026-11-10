import { CalendarClock } from "lucide-react";
import { descreverPrazo, urgencia, type PendenciaCronograma } from "@/lib/cronograma";
import { formatarDataCurta, rotuloTipo } from "@/lib/visitas";
import { SituacaoBadge } from "@/components/cronograma/situacao-badge";

/**
 * O que ainda falta do cronograma de implantação neste estabelecimento, para o técnico ver no check-in: atividade, equipes
 * e prazo. Sem pendência, não mostra nada.
 */
export function PendenciasCronograma({ itens }: { itens: PendenciaCronograma[] }) {
  if (!itens.length) return null;
  const ordenados = [...itens].sort((a, b) => urgencia(a.situacao) - urgencia(b.situacao) || a.prazo.localeCompare(b.prazo));
  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="pendencias-cronograma">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-primary">
        <CalendarClock className="size-4" />
        Cronograma: o que falta neste estabelecimento
      </div>
      <ul className="space-y-2">
        {ordenados.map((i) => (
          <li key={`${i.tipo}-${i.prazo}-${i.equipeNomes.join("|")}`} className="rounded-md px-2 py-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{i.equipeNomes.length ? i.equipeNomes.join(", ") : "Todas as equipes"}</span>
              <span className="text-muted-foreground">· {rotuloTipo(i.tipo)}</span>
              <SituacaoBadge situacao={i.situacao} />
            </div>
            <div className="text-xs text-muted-foreground">
              até {formatarDataCurta(i.prazo)} ({descreverPrazo(i.diasParaPrazo)})
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
