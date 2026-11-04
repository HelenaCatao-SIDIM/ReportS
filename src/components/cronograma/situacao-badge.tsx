import { ROTULO_SITUACAO } from "@/lib/cronograma";
import type { SituacaoCronograma } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ESTILO: Record<SituacaoCronograma, string> = {
  cumprido: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cumprido_com_atraso: "border-amber-300 bg-amber-50 text-amber-900",
  no_prazo: "",
  a_vencer: "border-amber-300 bg-amber-50 text-amber-900",
  atrasado: "",
  cancelado: "text-muted-foreground",
};

/** Selo da situação de um item do cronograma, igual em todas as telas. */
export function SituacaoBadge({ situacao }: { situacao: SituacaoCronograma }) {
  const variante = situacao === "atrasado" ? "destructive" : "outline";
  return (
    <Badge variant={variante} className={cn(ESTILO[situacao])}>
      {ROTULO_SITUACAO[situacao]}
    </Badge>
  );
}
