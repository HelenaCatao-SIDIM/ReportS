import { GitCompareArrows } from "lucide-react";
import type { VisitaDetalhada } from "@/lib/types";
import { formatarData } from "@/lib/datas";
import { rotuloTipo } from "@/lib/visitas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * O que mudou desde uma emissão: correções feitas nas visitas (pelo histórico) depois de `desde`
 * (e até `ate`, quando é uma versão já emitida) e visitas que entraram ou saíram da lista.
 */
export function Mudancas({
  titulo,
  visitas,
  idsAnteriores,
  visitasAnteriores,
  desde,
  ate,
}: {
  titulo: string;
  visitas: VisitaDetalhada[];
  idsAnteriores: string[];
  /** Para descrever as visitas que saíram (vêm da versão anterior). */
  visitasAnteriores: VisitaDetalhada[];
  desde: string;
  ate?: string;
}) {
  const nome = (v: VisitaDetalhada) => `${formatarData(v.entrada)} · ${rotuloTipo(v.tipo)} · ${v.unidadeNome}`;
  const entraram = visitas.filter((v) => !idsAnteriores.includes(v.id));
  const sairam = visitasAnteriores.filter((v) => !visitas.some((x) => x.id === v.id));
  const corrigidas = visitas
    .map((v) => ({ v, correcoes: v.historico.filter((h) => h.acao === "correcao" && h.em > desde && (!ate || h.em <= ate)) }))
    .filter((x) => x.correcoes.length);

  const nada = !entraram.length && !sairam.length && !corrigidas.length;

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows className="size-4" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {nada && <p className="text-muted-foreground">Nenhuma alteração nas visitas.</p>}
        {corrigidas.map(({ v, correcoes }) => (
          <div key={v.id}>
            <div className="font-medium">{nome(v)}</div>
            {correcoes.map((h) => (
              <div key={h.id} className="mt-1">
                <ul className="space-y-0.5 text-xs">
                  {h.mudancas.map((m, i) => (
                    <li key={i}>
                      <span className="font-medium">{m.campo}:</span> <span className="text-muted-foreground line-through">{m.antes}</span> → {m.depois}
                    </li>
                  ))}
                </ul>
                <p className="mt-0.5 text-xs text-muted-foreground">Motivo: {h.motivo}</p>
              </div>
            ))}
          </div>
        ))}
        {entraram.length > 0 && (
          <div>
            <div className="font-medium">Visitas incluídas</div>
            <ul className="text-xs">
              {entraram.map((v) => (
                <li key={v.id}>+ {nome(v)}</li>
              ))}
            </ul>
          </div>
        )}
        {sairam.length > 0 && (
          <div>
            <div className="font-medium">Visitas retiradas</div>
            <ul className="text-xs">
              {sairam.map((v) => (
                <li key={v.id}>− {nome(v)}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
