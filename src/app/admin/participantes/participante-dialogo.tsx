"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { Participante } from "@/lib/types";
import { formatarCpf } from "@/lib/format";
import { salvarParticipante, type ParticipanteFormState } from "./actions";
import { Campo } from "@/components/form/campo";
import { CboCampo } from "@/components/form/cbo-campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  clienteId: string;
  exigeCpf: boolean;
  setores: string[];
  participante?: Participante;
}

function ParticipanteForm({ clienteId, exigeCpf, setores, participante, onSalvo }: Props & { onSalvo: () => void }) {
  const [state, action, pending] = useActionState<ParticipanteFormState, FormData>(
    salvarParticipante.bind(null, clienteId, participante?.id ?? null),
    {},
  );
  const e = state.erros ?? {};
  const v = state.valores ?? participante;
  const [cpf, setCpf] = useState(formatarCpf(v?.cpf ?? ""));

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      <Campo id="p-nome" label="Nome" erro={e.nome}>
        <Input id="p-nome" name="nome" defaultValue={v?.nome} className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      {state.pedirHomonimo && (
        <label className="-mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="homonimo" className="size-4 accent-primary" />
          É outra pessoa com o mesmo nome — cadastrar mesmo assim
        </label>
      )}
      <Campo id="p-setor" label="Setor (opcional)">
        <Input id="p-setor" name="setor" list="lista-setores" defaultValue={v?.setor} className="h-9" />
      </Campo>
      <datalist id="lista-setores">
        {setores.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Campo id="p-cbo" label="Ocupação (CBO)" erro={e.cbo} dica="Busque pelo nome da ocupação na tabela CBO.">
        <CboCampo id="p-cbo" name="cbo" inicial={v?.cbo ?? null} invalido={!!e.cbo} />
      </Campo>
      {exigeCpf && (
        <Campo id="p-cpf" label="CPF" erro={e.cpf} dica="Este cliente exige CPF. No relatório ele sai mascarado.">
          <Input
            id="p-cpf"
            name="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(ev) => setCpf(formatarCpf(ev.target.value))}
            className="h-9"
            aria-invalid={!!e.cpf}
          />
        </Campo>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {participante ? "Salvar" : "Cadastrar participante"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão + janela para cadastrar (sem `participante`) ou editar um participante. */
export function ParticipanteDialogo(props: Props) {
  const [aberto, setAberto] = useState(false);
  const { participante } = props;

  return (
    <>
      {participante ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          Editar
        </Button>
      ) : (
        <Button className="h-9" onClick={() => setAberto(true)}>
          <Plus />
          Novo participante
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{participante ? "Editar participante" : "Novo participante"}</DialogTitle>
            <DialogDescription>Pessoa que costuma participar dos treinamentos deste cliente.</DialogDescription>
          </DialogHeader>
          {/* Remonta a cada abertura para começar sem erros antigos */}
          {aberto && <ParticipanteForm {...props} onSalvo={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
