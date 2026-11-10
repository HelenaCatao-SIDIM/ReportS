"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import type { ItemCronograma } from "@/lib/types";
import { TIPOS_VISITA } from "@/lib/visitas";
import { salvarItemCronograma, type ItemFormState } from "./actions";
import { Campo, selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ContratoOpcao {
  id: string;
  rotulo: string;
  clienteId: string;
}

export interface UnidadeOpcao {
  id: string;
  nome: string;
}

export interface EquipeOpcao {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Opcoes {
  /** Contratos ativos, para criar. */
  contratos: ContratoOpcao[];
  /** Estabelecimentos por cliente. */
  unidades: Record<string, UnidadeOpcao[]>;
  /** Cadastro único de Equipes (as inativas só aparecem se o item já as tinha). */
  equipes: EquipeOpcao[];
}

function ItemForm({ item, rotuloContrato, opcoes, onSalvo }: { item?: ItemCronograma; rotuloContrato?: string; opcoes: Opcoes; onSalvo: () => void }) {
  const [state, action, pending] = useActionState<ItemFormState, FormData>(salvarItemCronograma.bind(null, item?.id ?? null), {});
  const e = state.erros ?? {};
  const v =
    state.valores ??
    (item ? { contratoId: item.contratoId, unidadeId: item.unidadeId, equipeIds: item.equipeIds, tipo: item.tipo, prazo: item.prazo, observacao: item.observacao } : undefined);

  const [contratoId, setContratoId] = useState(v?.contratoId ?? "");
  const [unidadeId, setUnidadeId] = useState(v?.unidadeId ?? "");
  const [equipeIds, setEquipeIds] = useState<string[]>(v?.equipeIds ?? []);

  const clienteId = item ? item.clienteId : opcoes.contratos.find((c) => c.id === contratoId)?.clienteId;
  const unidades = (clienteId && opcoes.unidades[clienteId]) || [];
  const equipes = opcoes.equipes.filter((x) => x.ativo || item?.equipeIds.includes(x.id));
  const alternar = (id: string) => setEquipeIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate className="grid gap-4">
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}
      <Campo id="c-contrato" label="Contrato (cliente e sistema)" erro={e.contratoId}>
        {item ? (
          <Input id="c-contrato" value={rotuloContrato ?? "—"} disabled className="h-9" />
        ) : (
          <select
            id="c-contrato"
            name="contratoId"
            value={contratoId}
            onChange={(ev) => {
              setContratoId(ev.target.value);
              setUnidadeId("");
            }}
            className={selectClass}
            aria-invalid={!!e.contratoId}
          >
            <option value="" disabled>
              Escolha…
            </option>
            {opcoes.contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo id="c-unidade" label="Estabelecimento" erro={e.unidadeId}>
        <select
          id="c-unidade"
          name="unidadeId"
          value={unidadeId}
          onChange={(ev) => setUnidadeId(ev.target.value)}
          disabled={!clienteId}
          className={selectClass}
          aria-invalid={!!e.unidadeId}
        >
          <option value="" disabled>
            {clienteId ? "Escolha…" : "Escolha o contrato primeiro"}
          </option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </Campo>
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Equipes</legend>
        {equipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada. Cadastre em Administração → Equipes.</p>
        ) : (
          <div className="grid gap-1.5 rounded-lg border p-3 sm:grid-cols-2">
            {equipes.map((x) => (
              <label key={x.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="equipeIds"
                  value={x.id}
                  checked={equipeIds.includes(x.id)}
                  onChange={() => alternar(x.id)}
                  className="size-4 accent-primary"
                />
                {x.nome}
                {!x.ativo && <span className="text-xs text-muted-foreground">(inativa)</span>}
              </label>
            ))}
          </div>
        )}
        {e.equipeIds ? (
          <p className="text-xs text-destructive">{e.equipeIds}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            A visita precisa marcar todas essas equipes como treinadas. Sem nenhuma marcada, vale qualquer visita do tipo no estabelecimento.
          </p>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="c-tipo" label="Atividade" erro={e.tipo} dica="A visita encerrada desse tipo, no estabelecimento, cumpre o item.">
          <select id="c-tipo" name="tipo" defaultValue={v?.tipo ?? "treinamento"} className={selectClass} aria-invalid={!!e.tipo}>
            {TIPOS_VISITA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="c-prazo" label="Prazo" erro={e.prazo} dica="Vale até o fim desse dia.">
          <Input id="c-prazo" name="prazo" type="date" defaultValue={v?.prazo} className="h-9" aria-invalid={!!e.prazo} />
        </Campo>
      </div>
      <Campo id="c-obs" label="Observação (interna)" erro={e.observacao} dica="Só a Administração vê. Não vai para o relatório do cliente.">
        <Textarea id="c-obs" name="observacao" rows={2} defaultValue={v?.observacao} aria-invalid={!!e.observacao} />
      </Campo>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {item ? "Salvar" : "Criar item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão + janela para criar (sem `item`) ou editar um item do cronograma. */
export function ItemDialogo({ item, rotuloContrato, opcoes }: { item?: ItemCronograma; rotuloContrato?: string; opcoes: Opcoes }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {item ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          Editar
        </Button>
      ) : (
        <Button className="h-9" onClick={() => setAberto(true)}>
          <Plus />
          Novo item
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{item ? "Editar item do cronograma" : "Novo item do cronograma"}</DialogTitle>
            <DialogDescription>
              Estabelecimento e equipes que devem receber a atividade até o prazo. O cumprimento é conferido pelas visitas encerradas.
            </DialogDescription>
          </DialogHeader>
          {aberto && <ItemForm item={item} rotuloContrato={rotuloContrato} opcoes={opcoes} onSalvo={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
