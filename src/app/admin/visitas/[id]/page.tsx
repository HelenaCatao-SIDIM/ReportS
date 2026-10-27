import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, History, Lock, Pencil } from "lucide-react";
import { buscarVisita } from "@/lib/repo/visitas";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { DetalheVisita } from "@/components/visita/detalhe-visita";
import { SelosVisita } from "@/components/visita/selos";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcoesAndamento } from "../acoes-andamento";

const ACAO = { encerramento: "Encerrada pelo gestor", cancelamento: "Check-in cancelado", correcao: "Correção" } as const;

export default function VisitaPage({ params, searchParams }: PageProps<"/admin/visitas/[id]">) {
  return (
    <>
      <Link href="/admin/visitas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Visitas
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/admin/visitas/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await buscarVisita(id);
  if (!v) notFound();
  const podeCorrigir = v.status === "encerrada" && !v.travada;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{v.clienteNome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {formatarData(v.entrada)} · {v.tecnicoNome}
            <SelosVisita visita={v} alertaRaio />
          </p>
        </div>
        <div className="flex gap-2">
          {v.status === "em_andamento" && (
            <AcoesAndamento
              visita={{ id: v.id, tecnicoNome: v.tecnicoNome, clienteNome: v.clienteNome, entrada: v.entrada, entradaTexto: formatarDataHora(v.entrada) }}
            />
          )}
          {podeCorrigir && (
            <Button variant="outline" nativeButton={false} render={<Link href={`/admin/visitas/${v.id}/corrigir`} />}>
              <Pencil />
              Corrigir
            </Button>
          )}
        </div>
      </div>

      {sp.ok === "corrigida" && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">Correção salva e registrada no histórico.</AlertDescription>
        </Alert>
      )}
      {v.travada && (
        <Alert>
          <Lock />
          <AlertDescription>Esta visita está em um relatório aprovado pelo cliente e não pode mais ser alterada.</AlertDescription>
        </Alert>
      )}

      <DetalheVisita visita={v} cpf="completo" controle />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" />
            Histórico de alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {v.historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração. Esta visita está como o técnico registrou.</p>
          ) : (
            <ol className="space-y-4">
              {[...v.historico].reverse().map((h) => (
                <li key={h.id} className="border-l-2 border-primary/30 pl-4">
                  <div className="text-sm">
                    <span className="font-medium">{ACAO[h.acao]}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {h.autorNome} · {formatarDataHora(h.em)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">Motivo:</span> {h.motivo}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {h.mudancas.map((m, i) => (
                      <li key={i} className="rounded bg-muted/60 px-2 py-1">
                        <span className="font-medium">{m.campo}:</span> <span className="text-muted-foreground line-through">{m.antes}</span> → {m.depois}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
