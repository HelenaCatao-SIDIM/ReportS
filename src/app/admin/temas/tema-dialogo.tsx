"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import type { Tema } from "@/lib/types";
import { salvarTema, type TemaFormState } from "./actions";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Sugestoes {
  sistemas: string[];
  modulos: string[];
}

function TemaForm({ tema, sugestoes, onSalvo }: { tema?: Tema; sugestoes: Sugestoes; onSalvo: () => void }) {
  const [state, action, pending] = useActionState<TemaFormState, FormData>(salvarTema.bind(null, tema?.id ?? null), {});
  const e = state.erros ?? {};
  const v = state.valores ?? tema;

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}
      <Campo id="t-nome" label="Nome do tema" erro={e.nome}>
        <Input id="t-nome" name="nome" defaultValue={v?.nome} placeholder="Ex.: Emissão de guias de IPTU" className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="t-sistema" label="Sistema" erro={e.sistema}>
          <Input id="t-sistema" name="sistema" list="lista-sistemas" defaultValue={v?.sistema} className="h-9" aria-invalid={!!e.sistema} />
        </Campo>
        <Campo id="t-modulo" label="Módulo" erro={e.modulo}>
          <Input id="t-modulo" name="modulo" list="lista-modulos" defaultValue={v?.modulo} className="h-9" aria-invalid={!!e.modulo} />
        </Campo>
      </div>
      <datalist id="lista-sistemas">
        {sugestoes.sistemas.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="lista-modulos">
        {sugestoes.modulos.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {tema ? "Salvar" : "Criar tema"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão + janela para criar (sem `tema`) ou editar um tema. */
export function TemaDialogo({ tema, sugestoes }: { tema?: Tema; sugestoes: Sugestoes }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {tema ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          Editar
        </Button>
      ) : (
        <Button className="h-9" onClick={() => setAberto(true)}>
          <Plus />
          Novo tema
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tema ? "Editar tema" : "Novo tema"}</DialogTitle>
            <DialogDescription>O técnico marca os temas trabalhados durante a visita.</DialogDescription>
          </DialogHeader>
          {/* Remonta a cada abertura para começar sem erros antigos */}
          {aberto && <TemaForm tema={tema} sugestoes={sugestoes} onSalvo={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
