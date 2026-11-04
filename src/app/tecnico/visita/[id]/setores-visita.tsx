"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { SetorExtraVisita } from "@/lib/types";
import { selectClass } from "@/components/form/campo";
import { acrescentarSetor, retirarSetorAcrescentado } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Setores atendidos na visita: o do check-in e os que o técnico acrescenta (às vezes treina mais gente do que previa, de outros
 * setores). Vale até o check-out; o relatório lista todos, e cada setor cadastrado cumpre o item do cronograma dele.
 */
export function SetoresVisita({
  visitaId,
  principal,
  extras,
  disponiveis,
}: {
  visitaId: string;
  /** Nome do setor do check-in ("—" quando a visita não tem). */
  principal: string;
  extras: SetorExtraVisita[];
  /** Setores cadastrados do estabelecimento que ainda não estão na visita. */
  disponiveis: { id: string; nome: string }[];
}) {
  const [valor, setValor] = useState("");
  const [outro, setOutro] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pronto = valor === "outro" ? outro.trim().length > 0 : !!valor;

  function acrescentar() {
    setErro(null);
    start(async () => {
      const r = await acrescentarSetor(visitaId, valor, outro);
      if (r) setErro(r);
      else {
        setValor("");
        setOutro("");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Setores atendidos</h2>
          <p className="text-xs text-muted-foreground">Treinou mais gente do que previa? Acrescente aqui os setores, até o check-out.</p>
        </div>
        <ul className="divide-y rounded-lg border">
          <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="truncate">{principal}</span>
            <Badge variant="secondary">check-in</Badge>
          </li>
          {extras.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="truncate">
                {s.nome}
                {!s.setorId && <span className="ml-1 text-xs text-muted-foreground">(digitado)</span>}
              </span>
              <button
                type="button"
                aria-label={`Retirar ${s.nome}`}
                disabled={pending}
                onClick={() => start(async () => void (await retirarSetorAcrescentado(visitaId, s.id)))}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <select aria-label="Setor a acrescentar" value={valor} onChange={(ev) => setValor(ev.target.value)} className={selectClass}>
            <option value="">Acrescentar setor…</option>
            {disponiveis.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
            <option value="outro">Outro (digitar)</option>
          </select>
          {valor === "outro" && <Input aria-label="Nome do setor" value={outro} onChange={(ev) => setOutro(ev.target.value)} placeholder="Nome do setor" className="h-11 text-base" />}
          {valor && (
            <Button type="button" variant="outline" disabled={!pronto || pending} onClick={acrescentar} className="h-11 w-full">
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Acrescentar à visita
            </Button>
          )}
          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
