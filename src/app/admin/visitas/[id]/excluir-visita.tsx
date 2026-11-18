"use client";

import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { excluirVisitaAcao, type ExclusaoState } from "../actions";
import { useAcao } from "@/components/form/use-acao";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Botão "Excluir" de uma visita encerrada, com janela que pede a palavra EXCLUIR (apaga de vez, sem desfazer). */
export function ExcluirVisita({ visitaId, resumo }: { visitaId: string; resumo: string }) {
  const [aberta, setAberta] = useState(false);
  const [state, onSubmit, pending] = useAcao<ExclusaoState>(excluirVisitaAcao.bind(null, visitaId), {});

  return (
    <>
      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setAberta(true)}>
        <Trash2 />
        Excluir
      </Button>
      <Dialog open={aberta} onOpenChange={(o) => !o && setAberta(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir visita</DialogTitle>
            <DialogDescription>Apaga de vez esta visita, com as presenças e o histórico. Não dá para desfazer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {state.erro && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{state.erro}</AlertDescription>
              </Alert>
            )}
            <p className="rounded-lg bg-muted/60 p-3 text-sm">{resumo}</p>
            <Campo id="x-confirmar" label="Para confirmar, digite EXCLUIR">
              <Input id="x-confirmar" name="confirmar" autoComplete="off" placeholder="EXCLUIR" className="h-9" />
            </Campo>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberta(false)}>
                Voltar
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Excluir visita
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
