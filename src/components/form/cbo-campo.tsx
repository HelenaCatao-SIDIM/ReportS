"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { pesquisarCbo } from "@/app/actions/cbo";
import { formatarCbo } from "@/lib/format";
import type { Cbo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Escolha da ocupação (CBO) buscando pelo nome da ocupação.
 * Envia o código no campo oculto `name`; o servidor busca o título na tabela.
 */
export function CboCampo({
  id,
  name,
  inicial,
  invalido,
  onMudar,
}: {
  id: string;
  name: string;
  inicial: Cbo | null;
  invalido?: boolean;
  /** Avisa quando a ocupação é escolhida ou trocada (ex.: para guardar rascunho). */
  onMudar?: (cbo: Cbo | null) => void;
}) {
  const [escolhido, setEscolhidoLocal] = useState<Cbo | null>(inicial);
  const setEscolhido = (c: Cbo | null) => {
    setEscolhidoLocal(c);
    onMudar?.(c);
  };
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Cbo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const listaId = useId();

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  // Busca com pequena espera para não disparar a cada tecla; respostas atrasadas são descartadas.
  function buscar(novo: string) {
    setTermo(novo);
    clearTimeout(timer.current);
    const n = ++seq.current;
    if (novo.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const r = await pesquisarCbo(novo);
      if (n !== seq.current) return;
      setResultados(r);
      setAtivo(0);
      setBuscando(false);
    }, 250);
  }

  const escolher = (c: Cbo) => {
    setEscolhido(c);
    buscar("");
  };

  if (escolhido) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-input px-2.5 text-sm">
        <input type="hidden" name={name} value={escolhido.codigo} />
        <span className="truncate">
          <span className="font-mono text-xs text-muted-foreground">{formatarCbo(escolhido.codigo)}</span> {escolhido.titulo}
        </span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Trocar ocupação" onClick={() => setEscolhido(null)}>
          <X />
        </Button>
      </div>
    );
  }

  const aberto = termo.trim().length >= 2;

  return (
    <div className="relative">
      <input type="hidden" name={name} value="" />
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-invalid={invalido}
        autoComplete="off"
        placeholder="Digite a ocupação, ex.: enfermeiro"
        value={termo}
        onChange={(e) => buscar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((a) => Math.min(a + 1, resultados.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(a - 1, 0));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (resultados[ativo]) escolher(resultados[ativo]);
          }
          if (e.key === "Escape") buscar("");
        }}
        className="h-9 pl-8"
      />
      {buscando && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {aberto && !buscando && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {resultados.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">Nenhuma ocupação encontrada.</li>
          ) : (
            resultados.map((c, i) => (
              <li
                key={c.codigo}
                role="option"
                aria-selected={i === ativo}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(c);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={cn("cursor-pointer rounded-md px-2 py-1.5", i === ativo && "bg-muted")}
              >
                <span className="font-mono text-xs text-muted-foreground">{formatarCbo(c.codigo)}</span> {c.titulo}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
