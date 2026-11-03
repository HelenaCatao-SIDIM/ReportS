"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import type { Equipe, Tema } from "@/lib/types";
import { normalizar } from "@/lib/format";
import { salvarEquipe, type EquipeFormState } from "./actions";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function EquipeForm({ equipe, temas, onSalvo }: { equipe?: Equipe; temas: Tema[]; onSalvo: () => void }) {
  const [state, action, pending] = useActionState<EquipeFormState, FormData>(salvarEquipe.bind(null, equipe?.id ?? null), {});
  const e = state.erros ?? {};
  const v = state.valores ?? equipe;
  const [selecionados, setSelecionados] = useState<string[]>(v?.temaIds ?? []);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  // Temas inativos só aparecem se já eram mínimos desta equipe.
  const disponiveis = temas.filter((t) => t.ativo || equipe?.temaIds.includes(t.id));
  const b = normalizar(busca);
  const filtrados = disponiveis.filter((t) => !b || [t.nome, t.sistemaNome, t.modulo].some((c) => normalizar(c).includes(b)));
  const alternar = (id: string) => setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      <Campo id="e-nome" label="Nome da equipe" erro={e.nome}>
        <Input id="e-nome" name="nome" defaultValue={v?.nome} placeholder="Ex.: Equipe de enfermagem" className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Temas mínimos</span>
          <span className="text-xs text-muted-foreground">{selecionados.length} marcado(s)</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar tema, sistema ou módulo" aria-label="Buscar tema" className="h-9 pl-8" />
        </div>
        <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
          {filtrados.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum tema encontrado.</li>}
          {filtrados.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                <input type="checkbox" checked={selecionados.includes(t.id)} onChange={() => alternar(t.id)} className="size-4 shrink-0 accent-primary" />
                <span className="min-w-0">
                  <span className="block text-sm">
                    {t.nome}
                    {!t.ativo && <span className="ml-1 text-xs text-muted-foreground">(inativo)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.sistemaNome} · {t.modulo}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {selecionados.map((id) => (
          <input key={id} type="hidden" name="temaIds" value={id} />
        ))}
        {e.temas ? (
          <p className="text-xs text-destructive">{e.temas}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pode misturar sistemas: na visita, o ReportS sugere só os temas do sistema do contrato.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {equipe ? "Salvar" : "Criar equipe"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão + janela para criar (sem `equipe`) ou editar uma equipe. */
export function EquipeDialogo({ equipe, temas }: { equipe?: Equipe; temas: Tema[] }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {equipe ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          Editar
        </Button>
      ) : (
        <Button className="h-9" onClick={() => setAberto(true)}>
          <Plus />
          Nova equipe
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{equipe ? "Editar equipe" : "Nova equipe"}</DialogTitle>
            <DialogDescription>Vale para todos os clientes.</DialogDescription>
          </DialogHeader>
          {/* Remonta a cada abertura para começar sem erros antigos */}
          {aberto && <EquipeForm equipe={equipe} temas={temas} onSalvo={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
