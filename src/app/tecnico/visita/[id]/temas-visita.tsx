"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CloudCheck, Loader2, Search, X } from "lucide-react";
import type { Tema } from "@/lib/types";
import { normalizar } from "@/lib/format";
import { chaveRascunhoTema } from "@/lib/regras-visita";
import { cn } from "@/lib/utils";
import { salvarTemaAdicional, salvarTemas } from "../actions";
import { apagarRascunho, guardarRascunho, lerRascunho } from "@/components/tecnico/rascunho";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Situacao = "parado" | "salvando" | "salvo" | { erro: string };

function Indicador({ s }: { s: Situacao }) {
  if (s === "salvando")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Salvando…
      </span>
    );
  if (s === "salvo")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-700">
        <CloudCheck className="size-3.5" />
        Salvo
      </span>
    );
  if (typeof s === "object") return <span className="text-xs text-destructive">{s.erro}</span>;
  return null;
}

/** Temas da visita: marcar/desmarcar salva na hora. */
export function TemasVisita({
  visitaId,
  temas,
  inicial,
  adicionalInicial,
}: {
  visitaId: string;
  temas: Tema[];
  inicial: string[];
  adicionalInicial: string;
}) {
  const [selecionados, setSelecionados] = useState<string[]>(inicial);
  const [busca, setBusca] = useState("");
  const [adicional, setAdicional] = useState(adicionalInicial);
  const [situacao, setSituacao] = useState<Situacao>("parado");
  const [, start] = useTransition();

  // O que foi digitado e não chegou a ser salvo (aba fechada, celular travado) volta ao abrir e é salvo na hora.
  useEffect(() => {
    const t = setTimeout(() => {
      const chave = chaveRascunhoTema(visitaId);
      const recuperado = lerRascunho<string>(chave);
      if (typeof recuperado !== "string" || recuperado.trim() === adicionalInicial.trim()) {
        apagarRascunho(chave);
        return;
      }
      setAdicional(recuperado);
      setSituacao("salvando");
      start(async () => {
        const erro = await salvarTemaAdicional(visitaId, recuperado);
        if (!erro) apagarRascunho(chave);
        setSituacao(erro ? { erro } : "salvo");
      });
    }, 0);
    return () => clearTimeout(t);
  }, [visitaId, adicionalInicial]);

  function salvar(acao: () => Promise<string | null>) {
    setSituacao("salvando");
    start(async () => {
      const erro = await acao();
      setSituacao(erro ? { erro } : "salvo");
    });
  }

  function alternar(id: string) {
    const novos = selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id];
    setSelecionados(novos);
    salvar(() => salvarTemas(visitaId, novos));
  }

  const b = normalizar(busca);
  const filtrados = temas.filter((t) => !b || [t.nome, t.sistemaNome, t.modulo].some((c) => normalizar(c).includes(b)));
  const marcados = temas.filter((t) => selecionados.includes(t.id));

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Temas trabalhados</h2>
          <Indicador s={situacao} />
        </div>

        {marcados.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {marcados.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => alternar(t.id)}
                className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pr-2 pl-3 text-sm text-primary"
                aria-label={`Desmarcar ${t.nome}`}
              >
                {t.nome}
                <X className="size-3.5" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum tema marcado ainda.</p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tema, sistema ou módulo"
            aria-label="Buscar tema"
            className="h-11 pl-9 text-base"
          />
        </div>

        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {filtrados.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum tema encontrado. Use o campo abaixo.</li>}
          {filtrados.map((t) => {
            const marcado = selecionados.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => alternar(t.id)}
                  aria-pressed={marcado}
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", marcado && "bg-primary/5")}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      marcado ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {marcado && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm">{t.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.sistemaNome} · {t.modulo}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div>
          <label htmlFor="tema-adicional" className="mb-1.5 block text-sm font-medium">
            Tema adicional <span className="font-normal text-muted-foreground">(se não estiver na lista)</span>
          </label>
          <Input
            id="tema-adicional"
            value={adicional}
            onChange={(e) => {
              setAdicional(e.target.value);
              guardarRascunho(chaveRascunhoTema(visitaId), e.target.value);
            }}
            onBlur={() =>
              adicional.trim() !== adicionalInicial.trim() &&
              salvar(async () => {
                const erro = await salvarTemaAdicional(visitaId, adicional);
                if (!erro) apagarRascunho(chaveRascunhoTema(visitaId));
                return erro;
              })
            }
            placeholder="Descreva o tema"
            className="h-11 text-base"
          />
        </div>
      </CardContent>
    </Card>
  );
}
