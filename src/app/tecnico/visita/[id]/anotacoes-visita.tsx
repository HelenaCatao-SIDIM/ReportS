"use client";

import { useRef, useState } from "react";
import { CloudCheck, Loader2 } from "lucide-react";
import { CAMPOS_ANOTACAO, chaveRascunho } from "@/lib/regras-visita";
import { salvarAnotacoes } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Valores = Record<(typeof CAMPOS_ANOTACAO)[number]["nome"], string>;
type Situacao = "parado" | "salvando" | "salvo" | { erro: string };

/**
 * Anotações da visita, escritas enquanto ela acontece. Salvam sozinhas (logo depois de parar de digitar e ao sair do campo) e o
 * check-out parte delas: nada se perde se o técnico só fechar a tela.
 */
export function AnotacoesVisita({ visitaId, inicial }: { visitaId: string; inicial: Valores }) {
  const [valores, setValores] = useState<Valores>(inicial);
  const [situacao, setSituacao] = useState<Situacao>("parado");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ultimo = useRef<Valores>(inicial);
  const sujo = useRef(false);

  async function salvar(v: Valores) {
    sujo.current = false;
    setSituacao("salvando");
    // O check-out guarda o rascunho no aparelho com os mesmos campos: mantém os dois iguais.
    try {
      localStorage.setItem(chaveRascunho(visitaId), JSON.stringify(v));
    } catch {}
    const erro = await salvarAnotacoes(visitaId, v);
    setSituacao(erro ? { erro } : "salvo");
  }

  function mudar(nome: keyof Valores, texto: string) {
    const novo = { ...valores, [nome]: texto };
    setValores(novo);
    ultimo.current = novo;
    sujo.current = true;
    setSituacao("parado");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvar(novo), 700);
  }

  function aoSair() {
    clearTimeout(timer.current);
    if (sujo.current) void salvar(ultimo.current);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Anotações</h2>
          {situacao === "salvando" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Salvando…
            </span>
          )}
          {situacao === "salvo" && (
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <CloudCheck className="size-3.5" />
              Salvo
            </span>
          )}
          {typeof situacao === "object" && <span className="text-xs text-destructive">{situacao.erro}</span>}
        </div>
        <p className="text-xs text-muted-foreground">Vá anotando durante a visita. No check-out você pode completar.</p>
        {CAMPOS_ANOTACAO.map((c) => (
          <div key={c.nome}>
            <Label htmlFor={`anotacao-${c.nome}`} className="mb-1">
              {c.rotulo}
            </Label>
            <p className="mb-1.5 text-xs text-muted-foreground">{c.dica}</p>
            <Textarea
              id={`anotacao-${c.nome}`}
              rows={3}
              value={valores[c.nome]}
              onChange={(ev) => mudar(c.nome, ev.target.value)}
              onBlur={aoSair}
              maxLength={4000}
              className="text-base"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
