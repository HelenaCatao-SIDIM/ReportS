"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquareWarning } from "lucide-react";
import { aprovar, pedirAjuste, type DecisaoState } from "./actions";
import { useAcao } from "@/components/form/use-acao";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Botões de decisão do aprovador: aprovar (com confirmação) ou pedir ajuste (motivo obrigatório). */
export function Decisao({ token, aprovadorNome, horas }: { token: string; aprovadorNome: string; horas: string }) {
  const [janela, setJanela] = useState<"aprovar" | "ajuste" | null>(null);
  const [erroAprovar, setErroAprovar] = useState<string | null>(null);
  const [aprovando, start] = useTransition();
  const [state, onSubmit, enviando] = useAcao<DecisaoState>(pedirAjuste.bind(null, token), {});
  const ocupado = aprovando || enviando;

  function confirmarAprovacao() {
    setErroAprovar(null);
    start(async () => {
      const r = await aprovar(token);
      if (r?.erro) setErroAprovar(r.erro);
    });
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button className="h-12 bg-emerald-600 text-base hover:bg-emerald-600/90" onClick={() => setJanela("aprovar")}>
          <CheckCircle2 />
          Aprovar relatório
        </Button>
        <Button variant="outline" className="h-12 text-base" onClick={() => setJanela("ajuste")}>
          <MessageSquareWarning />
          Pedir ajuste
        </Button>
      </div>

      <Dialog open={janela !== null} onOpenChange={(o) => !ocupado && !o && setJanela(null)}>
        <DialogContent className="sm:max-w-md">
          {janela === "aprovar" && (
            <>
              <DialogHeader>
                <DialogTitle>Aprovar o relatório?</DialogTitle>
                <DialogDescription>
                  Você, {aprovadorNome}, confirma os atendimentos deste relatório ({horas} presenciais). A aprovação libera o faturamento dos serviços e
                  não pode ser desfeita por este link.
                </DialogDescription>
              </DialogHeader>
              {erroAprovar && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{erroAprovar}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button variant="outline" disabled={ocupado} onClick={() => setJanela(null)}>
                  Voltar
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-600/90" disabled={ocupado} onClick={confirmarAprovacao}>
                  {aprovando ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Confirmar aprovação
                </Button>
              </DialogFooter>
            </>
          )}
          {janela === "ajuste" && (
            <form onSubmit={onSubmit} noValidate className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Pedir ajuste</DialogTitle>
                <DialogDescription>Explique o que precisa ser corrigido. A SIDIM fará o ajuste e enviará uma nova versão para aprovação.</DialogDescription>
              </DialogHeader>
              {state.erro && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{state.erro}</AlertDescription>
                </Alert>
              )}
              <div>
                <Textarea
                  name="motivo"
                  rows={4}
                  aria-label="Motivo do ajuste"
                  placeholder="Ex.: a visita de 09/10 foi às 14h, não às 13h; faltou um participante na lista."
                  aria-invalid={!!state.erroMotivo}
                  className="text-base"
                />
                {state.erroMotivo && <p className="mt-1.5 text-xs text-destructive">{state.erroMotivo}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={ocupado} onClick={() => setJanela(null)}>
                  Voltar
                </Button>
                <Button type="submit" disabled={ocupado}>
                  {enviando && <Loader2 className="animate-spin" />}
                  Enviar pedido de ajuste
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
