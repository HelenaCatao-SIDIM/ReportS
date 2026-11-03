"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CloudCheck, Loader2, Search, X } from "lucide-react";
import type { Tema } from "@/lib/types";
import { normalizar } from "@/lib/format";
import { chaveRascunhoTema } from "@/lib/regras-visita";
import { cn } from "@/lib/utils";
import { salvarEquipes, salvarTemaAdicional, salvarTemas } from "../actions";
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

/** Equipes que o técnico pode marcar para receber os temas mínimos como sugestão (implantação e treinamentos). */
export interface PorEquipe {
  equipes: { id: string; nome: string; temaIds: string[] }[];
  inicial: string[];
}

function LinhaTema({ t, marcado, onClick }: { t: Tema; marcado: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} aria-pressed={marcado} className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", marcado && "bg-primary/5")}>
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
}

/** Temas da visita: marcar/desmarcar salva na hora. Com `porEquipe`, também as equipes treinadas e os temas mínimos sugeridos. */
export function TemasVisita({
  visitaId,
  temas,
  inicial,
  adicionalInicial,
  porEquipe,
}: {
  visitaId: string;
  temas: Tema[];
  inicial: string[];
  adicionalInicial: string;
  porEquipe?: PorEquipe;
}) {
  const [selecionados, setSelecionados] = useState<string[]>(inicial);
  const [equipeIds, setEquipeIds] = useState<string[]>(porEquipe?.inicial ?? []);
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

  function alternarEquipe(id: string) {
    const novas = equipeIds.includes(id) ? equipeIds.filter((x) => x !== id) : [...equipeIds, id];
    setEquipeIds(novas);
    salvar(() => salvarEquipes(visitaId, novas));
  }

  // Temas mínimos das equipes marcadas, só os do sistema do contrato (os `temas` recebidos já são desse sistema).
  const escolhidas = porEquipe?.equipes.filter((e) => equipeIds.includes(e.id)) ?? [];
  const sugeridos = temas.filter((t) => escolhidas.some((e) => e.temaIds.includes(t.id)));

  const b = normalizar(busca);
  const outros = temas.filter((t) => !sugeridos.includes(t));
  const filtrados = outros.filter((t) => !b || [t.nome, t.sistemaNome, t.modulo].some((c) => normalizar(c).includes(b)));
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

        {porEquipe && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="text-sm font-medium">Equipes treinadas</div>
            {porEquipe.equipes.length ? (
              <div className="flex flex-wrap gap-1.5">
                {porEquipe.equipes.map((e) => {
                  const marcada = equipeIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => alternarEquipe(e.id)}
                      aria-pressed={marcada}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                        marcada ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                      )}
                    >
                      {marcada && <Check className="size-3.5" />}
                      {e.nome}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma equipe cadastrada.</p>
            )}
            {sugeridos.length > 0 && (
              <>
                <div className="pt-1 text-sm font-medium">Temas mínimos sugeridos</div>
                <ul className="divide-y rounded-lg border bg-background">
                  {sugeridos.map((t) => (
                    <LinhaTema key={t.id} t={t} marcado={selecionados.includes(t.id)} onClick={() => alternar(t.id)} />
                  ))}
                </ul>
              </>
            )}
            {porEquipe.equipes.length > 0 && !sugeridos.length && (
              <p className="text-xs text-muted-foreground">
                {escolhidas.length
                  ? "As equipes marcadas não têm temas mínimos neste sistema."
                  : "Marque as equipes para ver os temas mínimos sugeridos."}
              </p>
            )}
          </div>
        )}

        {porEquipe && <div className="text-sm font-medium">Outros temas</div>}
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
          {filtrados.map((t) => (
            <LinhaTema key={t.id} t={t} marcado={selecionados.includes(t.id)} onClick={() => alternar(t.id)} />
          ))}
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
