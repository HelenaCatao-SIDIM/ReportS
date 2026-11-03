import { CalendarClock } from "lucide-react";
import { descreverPrazo, urgencia, type PendenciaCronograma } from "@/lib/cronograma";
import { formatarDataCurta, rotuloTipo } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { SituacaoBadge } from "@/components/cronograma/situacao-badge";

/**
 * O que ainda falta do cronograma de implantação neste estabelecimento, para o técnico ver no check-in.
 * O item do setor escolhido ganha destaque. Sem pendência, não mostra nada.
 */
export function PendenciasCronograma({ itens, setorId }: { itens: PendenciaCronograma[]; setorId: string }) {
  if (!itens.length) return null;
  const ordenados = [...itens].sort((a, b) => urgencia(a.situacao) - urgencia(b.situacao) || a.prazo.localeCompare(b.prazo));
  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="pendencias-cronograma">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-primary">
        <CalendarClock className="size-4" />
        Cronograma: o que falta neste estabelecimento
      </div>
      <ul className="space-y-2">
        {ordenados.map((i) => {
          const dele = setorId !== "" && (i.setorId === null || i.setorId === setorId);
          return (
            <li key={`${i.setorId ?? "todos"}-${i.tipo}-${i.prazo}`} className={cn("rounded-md px-2 py-1.5 text-sm", dele && "bg-background ring-1 ring-primary/40")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{i.setorNome ?? "Todos os setores"}</span>
                <span className="text-muted-foreground">· {rotuloTipo(i.tipo)}</span>
                <SituacaoBadge situacao={i.situacao} />
              </div>
              <div className="text-xs text-muted-foreground">
                até {formatarDataCurta(i.prazo)} ({descreverPrazo(i.diasParaPrazo)}){dele && " · este é o setor da visita"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
