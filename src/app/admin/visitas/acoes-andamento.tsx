"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { paraInputLocal } from "@/lib/datas";
import { cancelarVisita, encerrarVisita, type AcaoVisitaState } from "./actions";
import { useAcao } from "@/components/form/use-acao";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Resumo {
  id: string;
  tecnicoNome: string;
  clienteNome: string;
  entrada: string;
  entradaTexto: string;
}

function FormEncerrar({ visita, onFeito }: { visita: Resumo; onFeito: () => void }) {
  const [state, onSubmit, pending] = useAcao<AcaoVisitaState>(encerrarVisita.bind(null, visita.id), {});
  const e = state.erros ?? {};
  useEffect(() => {
    if (state.ok) onFeito();
  }, [state, onFeito]);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}
      <p className="rounded-lg bg-muted/60 p-3 text-sm">
        <span className="font-medium">{visita.tecnicoNome}</span> · {visita.clienteNome}
        <span className="block text-xs text-muted-foreground">Entrada em {visita.entradaTexto}</span>
      </p>
      <Campo id="e-saida" label="Horário real de saída" erro={e.saida} dica="Horário de Brasília. Use o horário informado pelo técnico ou pelo cliente.">
        <Input id="e-saida" name="saida" type="datetime-local" min={paraInputLocal(visita.entrada)} className="h-9" aria-invalid={!!e.saida} />
      </Campo>
      <Campo id="e-just" label="Justificativa" erro={e.justificativa}>
        <Textarea id="e-just" name="justificativa" rows={3} placeholder="Ex.: técnico esqueceu o check-out; saída confirmada por telefone." aria-invalid={!!e.justificativa} />
      </Campo>
      <p className="-mt-2 text-xs text-muted-foreground">Não exige resumo nem lista de presença. Fica registrado no histórico da visita.</p>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Encerrar visita
        </Button>
      </DialogFooter>
    </form>
  );
}

function FormCancelar({ visita, onFeito }: { visita: Resumo; onFeito: () => void }) {
  const [state, onSubmit, pending] = useAcao<AcaoVisitaState>(cancelarVisita.bind(null, visita.id), {});
  const e = state.erros ?? {};
  useEffect(() => {
    if (state.ok) onFeito();
  }, [state, onFeito]);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}
      <p className="rounded-lg bg-muted/60 p-3 text-sm">
        <span className="font-medium">{visita.tecnicoNome}</span> · {visita.clienteNome}
        <span className="block text-xs text-muted-foreground">Entrada em {visita.entradaTexto}</span>
      </p>
      <Campo id="c-just" label="Justificativa" erro={e.justificativa}>
        <Textarea id="c-just" name="justificativa" rows={3} placeholder="Ex.: check-in feito por engano no cliente errado." aria-invalid={!!e.justificativa} />
      </Campo>
      <p className="-mt-2 text-xs text-muted-foreground">A visita cancelada não entra em relatório. O registro e o histórico são mantidos.</p>
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Cancelar check-in
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botões "Encerrar" e "Cancelar" de uma visita em andamento, cada um com a sua janela. */
export function AcoesAndamento({ visita }: { visita: Resumo }) {
  const [aberta, setAberta] = useState<"encerrar" | "cancelar" | null>(null);
  const fechar = () => setAberta(null);

  return (
    <>
      <Button size="sm" onClick={() => setAberta("encerrar")}>
        Encerrar
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAberta("cancelar")}>
        Cancelar
      </Button>
      <Dialog open={aberta !== null} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{aberta === "cancelar" ? "Cancelar check-in" : "Encerrar visita"}</DialogTitle>
            <DialogDescription>
              {aberta === "cancelar"
                ? "Use quando o check-in foi aberto por engano."
                : "Use quando o técnico esqueceu de fazer o check-out."}
            </DialogDescription>
          </DialogHeader>
          {aberta === "encerrar" && <FormEncerrar visita={visita} onFeito={fechar} />}
          {aberta === "cancelar" && <FormCancelar visita={visita} onFeito={fechar} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
