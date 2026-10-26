import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Timer } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { horaDoServidor } from "@/lib/agora";
import { listarDoTecnico } from "@/lib/repo/visitas";
import { fimDoDia, formatarData, formatarDuracao, formatarHora, inicioDoDia, periodosRapidos } from "@/lib/datas";
import { rotuloTipo } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function MinhasVisitas({ searchParams }: PageProps<"/tecnico/visitas">) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Minhas visitas</h1>
        <p className="text-sm text-muted-foreground">Histórico das suas visitas.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const ATALHOS = [
  { id: "mes", label: "Este mês" },
  { id: "mesPassado", label: "Mês passado" },
  { id: "noventa", label: "90 dias" },
] as const;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

async function Conteudo({ searchParams }: Pick<PageProps<"/tecnico/visitas">, "searchParams">) {
  const [sp, usuario, agora] = await Promise.all([searchParams, getUsuarioAtual(), horaDoServidor()]);
  if (!usuario) return null;

  const rapidos = periodosRapidos(agora);
  const deTxt = typeof sp.de === "string" && DATA.test(sp.de) ? sp.de : "";
  const ateTxt = typeof sp.ate === "string" && DATA.test(sp.ate) ? sp.ate : "";
  const personalizado = !!(deTxt || ateTxt);
  const atalho = personalizado ? null : (ATALHOS.find((a) => a.id === sp.periodo)?.id ?? "mes");
  const periodo = atalho ? rapidos[atalho] : { de: deTxt, ate: ateTxt };

  const visitas = await listarDoTecnico(usuario.id, {
    de: periodo.de ? inicioDoDia(periodo.de) : undefined,
    ate: periodo.ate ? fimDoDia(periodo.ate) : undefined,
  });
  const encerradas = visitas.filter((v) => v.status === "encerrada").length;

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-background p-1">
          {ATALHOS.map((a) => (
            <Link
              key={a.id}
              href={`/tecnico/visitas?periodo=${a.id}`}
              className={cn(
                "rounded-md py-1.5 text-center text-sm",
                atalho === a.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {a.label}
            </Link>
          ))}
        </div>
        <form className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs text-muted-foreground">
            De
            <Input type="date" name="de" defaultValue={periodo.de} className="h-10 min-w-0 bg-background" />
          </label>
          <label className="min-w-0 text-xs text-muted-foreground">
            Até
            <Input type="date" name="ate" defaultValue={periodo.ate} className="h-10 min-w-0 bg-background" />
          </label>
          <Button type="submit" variant="outline" className="col-span-2 h-10">
            Filtrar período
          </Button>
        </form>
      </div>

      <p className="text-xs text-muted-foreground">
        {periodo.de ? formatarData(inicioDoDia(periodo.de)) : "início"} a {periodo.ate ? formatarData(inicioDoDia(periodo.ate)) : "hoje"} ·{" "}
        {visitas.length} {visitas.length === 1 ? "visita" : "visitas"}
        {encerradas !== visitas.length && ` (${encerradas} ${encerradas === 1 ? "encerrada" : "encerradas"})`}
      </p>

      {visitas.length === 0 ? (
        <Card className="items-center py-10 text-sm text-muted-foreground">Nenhuma visita neste período.</Card>
      ) : (
        <ul className="space-y-2">
          {visitas.map((v) => (
            <li key={v.id}>
              <Link href={`/tecnico/visita/${v.id}`} className="block">
                <Card
                  className={cn(
                    "gap-0 py-0 transition-colors active:bg-muted/60",
                    v.status === "em_andamento" && "border-primary/40 bg-primary/5",
                    v.status === "cancelada" && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-lg leading-none font-semibold">{formatarData(v.entrada).slice(0, 2)}</div>
                      <div className="text-xs text-muted-foreground">{formatarData(v.entrada).slice(3, 5)}/{formatarData(v.entrada).slice(8)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{v.clienteNome}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {v.unidadeNome} · {rotuloTipo(v.tipo)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {v.status === "em_andamento" ? (
                          <span className="flex items-center gap-1 font-medium text-primary">
                            <Timer className="size-3" />
                            Em andamento desde {formatarHora(v.entrada)} · continuar
                          </span>
                        ) : v.status === "cancelada" ? (
                          <Badge variant="destructive">Cancelada</Badge>
                        ) : (
                          <span>
                            {formatarHora(v.entrada)}–{v.saida ? formatarHora(v.saida) : "—"} · {v.saida ? formatarDuracao(v.entrada, v.saida) : "—"}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
