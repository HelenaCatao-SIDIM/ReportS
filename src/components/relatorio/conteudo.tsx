import Link from "next/link";
import { ChevronDown, ExternalLink, History } from "lucide-react";
import type { VisitaDetalhada } from "@/lib/types";
import { formatarData, formatarDuracao, formatarHora } from "@/lib/datas";
import { formatarCnpj } from "@/lib/format";
import { formatarDataCurta, formatarMinutos, rotuloTipo } from "@/lib/visitas";
import { DetalheVisita } from "@/components/visita/detalhe-visita";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DadosConteudo {
  cliente: { nome: string; cnpj: string; contrato: string };
  de: string;
  ate: string;
  visitas: VisitaDetalhada[];
  deOutroPeriodo: string[];
  minutosPresenciais: number;
  minutosOnline: number;
}

/** Capa, resumo de horas e visitas (expansíveis) de um relatório — rascunho atual ou versão congelada. */
export function ConteudoRelatorio({ c, tituloVisitas, linkVisitas }: { c: DadosConteudo; tituloVisitas: string; linkVisitas: boolean }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Capa</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Cliente</dt>
                <dd className="text-sm">{c.cliente.nome}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">CNPJ</dt>
                <dd className="text-sm">{formatarCnpj(c.cliente.cnpj)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Contrato</dt>
                <dd className="text-sm">{c.cliente.contrato}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Período</dt>
                <dd className="text-sm">
                  {formatarDataCurta(c.de)} a {formatarDataCurta(c.ate)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Total de horas presenciais</div>
              <div className="text-2xl font-semibold">{formatarMinutos(c.minutosPresenciais)}</div>
            </div>
            {c.minutosOnline > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Treinamento online</div>
                <div className="text-lg font-medium">{formatarMinutos(c.minutosOnline)}</div>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {c.visitas.length} {c.visitas.length === 1 ? "visita" : "visitas"}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{tituloVisitas}</h2>
        {c.visitas.length === 0 && (
          <Card className="items-center py-10 text-sm text-muted-foreground">Nenhuma visita.</Card>
        )}
        {c.visitas.map((v) => (
          <details key={v.id} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-not-open:-rotate-90" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {formatarData(v.entrada)} · {rotuloTipo(v.tipo)}
                  {c.deOutroPeriodo.includes(v.id) && (
                    <Badge variant="secondary">
                      <History />
                      Período anterior
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {v.unidadeNome} · {v.setorNome} · {v.tecnicoNome} · {formatarHora(v.entrada)}–{v.saida ? formatarHora(v.saida) : "—"} (
                  {v.saida ? formatarDuracao(v.entrada, v.saida) : "—"}) · {v.presencas.length} participante(s)
                </div>
              </div>
              {linkVisitas && (
                <Link href={`/admin/visitas/${v.id}`} className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
                  Abrir visita
                  <ExternalLink className="size-3" />
                </Link>
              )}
            </summary>
            <div className="border-t p-4">
              <DetalheVisita visita={v} cpf="mascarado" />
            </div>
          </details>
        ))}
      </section>
    </>
  );
}
