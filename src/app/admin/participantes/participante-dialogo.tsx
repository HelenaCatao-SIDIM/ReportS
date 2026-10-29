"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { Participante } from "@/lib/types";
import { formatarCpf } from "@/lib/format";
import { SeloParticipante } from "@/components/participante/selo-participante";
import { salvarParticipante, type ParticipanteFormState } from "./actions";
import { Campo } from "@/components/form/campo";
import { CboCampo } from "@/components/form/cbo-campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  sistemaDoClienteId: string;
  exigeCpf: boolean;
  setores: string[];
  participante?: Participante;
}

function ParticipanteForm({ sistemaDoClienteId, exigeCpf, setores, participante, onSalvo }: Props & { onSalvo: () => void }) {
  const [state, action, pending] = useActionState<ParticipanteFormState, FormData>(
    salvarParticipante.bind(null, sistemaDoClienteId, participante?.id ?? null),
    {},
  );
  const e = state.erros ?? {};
  const v = state.valores ?? participante;
  const [cpf, setCpf] = useState(formatarCpf(v?.cpf ?? ""));
  // O nome do confirmado vem do ERP: aparece, mas não se edita aqui.
  const confirmado = participante?.estado === "confirmado";

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      {participante && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SeloParticipante estado={participante.estado} />
          {participante.idErp && <span className="text-xs text-muted-foreground">ID no ERP: {participante.idErp}</span>}
        </div>
      )}
      <Campo
        id="p-nome"
        label="Nome"
        erro={e.nome}
        dica={confirmado ? "Vem do ERP e não pode ser editado aqui." : undefined}
      >
        <Input id="p-nome" name="nome" defaultValue={v?.nome} readOnly={confirmado} className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      {state.semelhantes && state.semelhantes.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">É esta pessoa?</p>
          <ul className="divide-y divide-amber-200">
            {state.semelhantes.map((x) => (
              <li key={x.id} className="py-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-1.5 font-medium">
                  {x.nome}
                  <SeloParticipante estado={x.estado} />
                </div>
                <div className="text-xs text-muted-foreground">{[x.cbo.titulo, x.setor].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-900">Se for a mesma pessoa, feche esta janela e edite o cadastro dela na lista.</p>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input type="checkbox" name="homonimo" className="size-4 accent-primary" />
            Não é nenhuma destas pessoas — salvar mesmo assim
          </label>
        </div>
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
        <Campo id="p-cpf" label="CPF" erro={e.cpf} dica="O contrato deste sistema exige CPF. No relatório ele sai mascarado.">
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
          {state.existente && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <span className="font-medium">{state.existente.nome}</span>
              <SeloParticipante estado={state.existente.estado} />
              <span className="text-xs text-muted-foreground">já tem este CPF neste sistema.</span>
            </div>
          )}
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
            <DialogTitle>{participante ? "Editar participante" : "Novo participante (provisório)"}</DialogTitle>
            <DialogDescription>
              {participante
                ? "CBO, setor e CPF são do ReportS; o nome do participante confirmado vem do ERP."
                : "Antes de cadastrar, o ReportS procura quem já tem o mesmo CPF ou um nome parecido neste sistema. Quem não tem o id do ERP entra como provisório."}
            </DialogDescription>
          </DialogHeader>
          {/* Remonta a cada abertura para começar sem erros antigos */}
          {aberto && <ParticipanteForm {...props} onSalvo={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
