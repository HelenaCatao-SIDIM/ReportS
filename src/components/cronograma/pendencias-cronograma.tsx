import { CalendarClock, Check } from "lucide-react";
import { descreverPrazo, urgencia, type PendenciaCronograma } from "@/lib/cronograma";
import { formatarDataCurta, rotuloTipo } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { SituacaoBadge } from "@/components/cronograma/situacao-badge";

/** Ordem da lista: os de hoje primeiro, depois do mais urgente ao menos urgente e pelo prazo. */
export const ordenarPrevistas = (itens: PendenciaCronograma[]) =>
  [...itens].sort(
    (a, b) => Number(b.diasParaPrazo === 0) - Number(a.diasParaPrazo === 0) || urgencia(a.situacao) - urgencia(b.situacao) || a.prazo.localeCompare(b.prazo),
  );

/**
 * As visitas previstas no cronograma para este estabelecimento (o que ainda falta), para o técnico ver no check-in: atividade,
 * equipes, prazo e horário. Com `onEscolher`, cada item é um botão: escolher preenche o check-in com a atividade e as equipes
 * dele (e tocar de novo desfaz). Sem pendência, não mostra nada.
 */
export function PendenciasCronograma({
  itens,
  escolhidoId,
  onEscolher,
}: {
  itens: PendenciaCronograma[];
  escolhidoId?: string | null;
  onEscolher?: (item: PendenciaCronograma | null) => void;
}) {
  if (!itens.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="pendencias-cronograma">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary">
        <CalendarClock className="size-4" />
        Visitas previstas neste estabelecimento
      </div>
      {onEscolher && <p className="mb-2 text-xs text-muted-foreground">Toque na visita que você vai fazer: a atividade e as equipes já vêm preenchidas.</p>}
      <ul className="space-y-1.5">
        {ordenarPrevistas(itens).map((i) => {
          const escolhido = escolhidoId === i.id;
          const conteudo = (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {escolhido && <Check className="size-4 shrink-0 text-primary" />}
                <span className="font-medium">{rotuloTipo(i.tipo)}</span>
                <span className="text-muted-foreground">· {i.equipeNomes.length ? i.equipeNomes.join(", ") : "Todas as equipes"}</span>
                <SituacaoBadge situacao={i.situacao} />
              </div>
              <div className="text-xs text-muted-foreground">
                {i.diasParaPrazo === 0 ? "hoje" : `até ${formatarDataCurta(i.prazo)} (${descreverPrazo(i.diasParaPrazo)})`}
                {i.horario && ` · ${i.horario}`}
              </div>
            </>
          );
          return (
            <li key={i.id}>
              {onEscolher ? (
                <button
                  type="button"
                  onClick={() => onEscolher(escolhido ? null : i)}
                  aria-pressed={escolhido}
                  className={cn(
                    "w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                    escolhido ? "border-primary bg-background ring-1 ring-primary" : "border-transparent hover:bg-background/70",
                  )}
                >
                  {conteudo}
                </button>
              ) : (
                <div className="rounded-md px-2 py-1.5 text-sm">{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
