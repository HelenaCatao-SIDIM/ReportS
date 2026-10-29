"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import type { Aprovador } from "@/lib/types";
import { salvarAprovador, type AprovadorFormState } from "./actions";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function AprovadorForm({ aprovador, onSalvo }: { aprovador?: Aprovador; onSalvo: () => void }) {
  const [state, action, pending] = useActionState<AprovadorFormState, FormData>(salvarAprovador.bind(null, aprovador?.id ?? null), {});
  const e = state.erros ?? {};
  const v = state.valores ?? aprovador;

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      {Object.keys(e).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Revise os campos destacados.</AlertDescription>
        </Alert>
      )}
      <Campo id="a-nome" label="Nome" erro={e.nome}>
        <Input id="a-nome" name="nome" defaultValue={v?.nome} className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      <Campo id="a-cargo" label="Cargo" dica="Um só, mesmo que a pessoa aprove para vários clientes.">
        <Input id="a-cargo" name="cargo" defaultValue={v?.cargo} className="h-9" />
      </Campo>
      <Campo id="a-email" label="E-mail" erro={e.email} dica="Para onde vai o link de aprovação. Não pode se repetir no cadastro.">
        <Input id="a-email" name="email" type="email" defaultValue={v?.email} placeholder="email@cliente.com.br" className="h-9" aria-invalid={!!e.email} />
      </Campo>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {aprovador ? "Salvar" : "Cadastrar aprovador"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão + janela para cadastrar (sem `aprovador`) ou editar um aprovador. */
export function AprovadorDialogo({ aprovador }: { aprovador?: Aprovador }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {aprovador ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          Editar
        </Button>
      ) : (
        <Button className="h-9" onClick={() => setAberto(true)}>
          <Plus />
          Novo aprovador
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{aprovador ? "Editar aprovador" : "Novo aprovador"}</DialogTitle>
            <DialogDescription>Quem aprova os relatórios pelo link do e-mail. Depois, marque a pessoa nos contratos em que ela aprova.</DialogDescription>
          </DialogHeader>
          {/* Remonta a cada abertura para começar sem erros antigos */}
          {aberto && <AprovadorForm aprovador={aprovador} onSalvo={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
