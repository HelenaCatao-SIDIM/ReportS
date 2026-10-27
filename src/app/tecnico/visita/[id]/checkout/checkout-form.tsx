"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Clock, Loader2, LocateFixed, LogOut } from "lucide-react";
import { formatarDuracao, formatarHora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { chaveRascunho } from "@/lib/regras-visita";
import { fazerCheckout, type CheckoutState } from "../../checkout-actions";
import { useAcao } from "@/components/form/use-acao";
import { useGps } from "@/components/tecnico/use-gps";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

const CAMPOS = [
  { nome: "observacoes", rotulo: "Observações", dica: "O que foi feito na visita." },
  { nome: "pendencias", rotulo: "Pendências", dica: "O que ficou para resolver (do cliente ou da SIDIM)." },
  { nome: "proximosPassos", rotulo: "Próximos passos", dica: "O que foi combinado para a próxima etapa." },
] as const;

interface Resumo {
  clienteNome: string;
  local: string;
  tipo: string;
  temas: number;
  fotos: number;
  participantes: number;
}

export function CheckoutForm({
  visitaId,
  entrada,
  presencial,
  resumo,
  faltaParticipantes,
}: {
  visitaId: string;
  entrada: string;
  presencial: boolean;
  resumo: Resumo;
  faltaParticipantes: boolean;
}) {
  const [state, onSubmit, pending] = useAcao<CheckoutState>(fazerCheckout.bind(null, visitaId), {});
  const e = state.erros ?? {};
  const { estado: gps, capturar } = useGps();
  const [agora, setAgora] = useState<number | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // Relógio da duração (atualiza a cada 30 s) e localização pedida ao abrir a tela.
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const primeiro = setTimeout(tick, 0);
    const intervalo = setInterval(tick, 30_000);
    if (presencial) capturar();
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, [presencial, capturar]);

  // Rascunho guardado no celular: recupera ao abrir.
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(chaveRascunho(visitaId)) ?? "{}") as Record<string, string>;
      for (const c of CAMPOS) {
        const campo = form.current?.elements.namedItem(c.nome) as HTMLTextAreaElement | null;
        if (campo && salvo[c.nome]) campo.value = salvo[c.nome];
      }
    } catch {}
  }, [visitaId]);

  function guardarRascunho() {
    try {
      const fd = new FormData(form.current!);
      localStorage.setItem(chaveRascunho(visitaId), JSON.stringify(Object.fromEntries(CAMPOS.map((c) => [c.nome, fd.get(c.nome)]))));
    } catch {}
  }

  const bloqueado = faltaParticipantes || (presencial && gps.fase !== "ok");

  return (
    <form ref={form} onSubmit={onSubmit} onInput={guardarRascunho} noValidate className="space-y-4">
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3">
          <div>
            <div className="text-base font-semibold">{resumo.clienteNome}</div>
            <div className="text-sm text-muted-foreground">{resumo.local}</div>
            <div className="text-sm text-muted-foreground">{resumo.tipo}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Entrada</div>
              <div className="font-medium">{formatarHora(entrada)}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Duração até agora</div>
              <div className="font-medium">{agora ? formatarDuracao(entrada, agora) : "—"}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              { n: resumo.temas, r: resumo.temas === 1 ? "tema" : "temas" },
              { n: resumo.fotos, r: resumo.fotos === 1 ? "foto extra" : "fotos extras" },
              { n: resumo.participantes, r: resumo.participantes === 1 ? "participante" : "participantes" },
            ].map((x) => (
              <div key={x.r} className="rounded-lg border p-2">
                <div className="text-lg font-semibold">{x.n}</div>
                <div className="text-xs text-muted-foreground">{x.r}</div>
              </div>
            ))}
          </div>
          <Link href={`/tecnico/visita/${visitaId}`} className="block text-center text-sm text-primary">
            Voltar e completar a visita
          </Link>
        </CardContent>
      </Card>

      {/* Segue os dados atuais da visita: um erro antigo não fica preso na tela ao voltar para ela. */}
      {faltaParticipantes && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Em treinamento, registre ao menos um participante antes do check-out.{" "}
            <Link href={`/tecnico/visita/${visitaId}`} className="font-medium underline">
              Ir para a lista de participantes
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4">
          {CAMPOS.map((c) => (
            <div key={c.nome}>
              <Label htmlFor={c.nome} className="mb-1">
                {c.rotulo}
              </Label>
              <p className="mb-1.5 text-xs text-muted-foreground">{c.dica}</p>
              <Textarea id={c.nome} name={c.nome} rows={3} className="text-base" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">O texto fica guardado neste aparelho enquanto você escreve.</p>
        </CardContent>
      </Card>

      {presencial && (
        <div className="rounded-lg border bg-background p-3">
          <input type="hidden" name="latitude" value={gps.fase === "ok" ? gps.latitude : ""} />
          <input type="hidden" name="longitude" value={gps.fase === "ok" ? gps.longitude : ""} />
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                gps.fase === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
              )}
            >
              {gps.fase === "buscando" ? <Loader2 className="size-4 animate-spin" /> : gps.fase === "ok" ? <Check className="size-4" /> : <LocateFixed className="size-4" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">Localização do check-out</div>
              {gps.fase === "buscando" && <p className="text-xs text-muted-foreground">Obtendo a localização…</p>}
              {gps.fase === "ok" && (
                <p className="font-mono text-xs text-muted-foreground">
                  {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ±{Math.round(gps.precisao)} m
                </p>
              )}
              {gps.fase === "erro" && <p className="text-xs text-destructive">{gps.mensagem}</p>}
              {e.gps && gps.fase !== "ok" && <p className="text-xs text-destructive">{e.gps}</p>}
            </div>
            {(gps.fase === "parado" || gps.fase === "erro") && (
              <Button type="button" size="sm" variant="outline" onClick={capturar}>
                {gps.fase === "erro" ? "Tentar de novo" : "Capturar"}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 pb-2">
        <Button type="submit" disabled={bloqueado || pending} className="h-12 w-full text-base">
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
          Confirmar check-out
        </Button>
        <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <Clock className="size-3" />A hora de saída é registrada pelo servidor. Depois disso, só a coordenação altera a visita.
        </p>
      </div>
    </form>
  );
}
