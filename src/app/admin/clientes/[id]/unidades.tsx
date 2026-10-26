"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import type { UnidadeComSetores } from "@/lib/repo/clientes";
import type { Setor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { removerSetor, removerUnidade, salvarSetor, salvarUnidade, type UnidadeFormState } from "../actions";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ---------- Diálogo de unidade (criar / editar) ----------

function UnidadeForm({ clienteId, unidade, onSalvo }: { clienteId: string; unidade?: UnidadeComSetores; onSalvo: () => void }) {
  const [state, action, pending] = useActionState<UnidadeFormState, FormData>(
    salvarUnidade.bind(null, clienteId, unidade?.id ?? null),
    {},
  );
  const e = state.erros ?? {};
  const v = state.valores ?? {
    nome: unidade?.nome ?? "",
    endereco: unidade?.endereco ?? "",
    latitude: String(unidade?.latitude ?? ""),
    longitude: String(unidade?.longitude ?? ""),
  };

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      <Campo id="u-nome" label="Nome da unidade" erro={e.nome}>
        <Input id="u-nome" name="nome" defaultValue={v.nome} placeholder="Ex.: Secretaria de Saúde" className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      <Campo id="u-endereco" label="Endereço">
        <Input id="u-endereco" name="endereco" defaultValue={v.endereco} className="h-9" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="u-lat" label="Latitude" erro={e.latitude}>
          <Input id="u-lat" name="latitude" inputMode="decimal" placeholder="-22.9035" defaultValue={v.latitude} className="h-9" aria-invalid={!!e.latitude} />
        </Campo>
        <Campo id="u-lng" label="Longitude" erro={e.longitude}>
          <Input id="u-lng" name="longitude" inputMode="decimal" placeholder="-47.0621" defaultValue={v.longitude} className="h-9" aria-invalid={!!e.longitude} />
        </Campo>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Opcionais. Nesta versão são apenas armazenadas.</p>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {unidade ? "Salvar" : "Adicionar unidade"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UnidadeDialog({
  clienteId,
  unidade,
  aberto,
  onFechar,
}: {
  clienteId: string;
  unidade?: UnidadeComSetores;
  aberto: boolean;
  onFechar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{unidade ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          <DialogDescription>Local do cliente onde os atendimentos acontecem.</DialogDescription>
        </DialogHeader>
        {/* Remonta a cada abertura para começar sem erros antigos */}
        {aberto && <UnidadeForm clienteId={clienteId} unidade={unidade} onSalvo={onFechar} />}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Setores ----------

function LinhaSetor({ setor }: { setor: Setor }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(setor.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const salvar = () =>
    start(async () => {
      const e = await salvarSetor(setor.unidadeId, setor.id, nome);
      setErro(e);
      if (!e) setEditando(false);
    });

  if (editando) {
    return (
      <li className="py-1.5">
        <div className="flex items-center gap-2">
          <Input
            aria-label="Nome do setor"
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") salvar();
              if (ev.key === "Escape") {
                setNome(setor.nome);
                setEditando(false);
                setErro(null);
              }
            }}
            autoFocus
            className="h-8"
          />
          <Button size="icon-sm" aria-label="Salvar setor" onClick={salvar} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Cancelar edição"
            onClick={() => {
              setNome(setor.nome);
              setEditando(false);
              setErro(null);
            }}
          >
            <X />
          </Button>
        </div>
        {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
      </li>
    );
  }

  return (
    <li className="group flex items-center justify-between gap-2 py-1.5 text-sm">
      <span>{setor.nome}</span>
      <span className="flex gap-1 opacity-60 group-hover:opacity-100">
        <Button size="icon-sm" variant="ghost" aria-label={`Renomear ${setor.nome}`} onClick={() => setEditando(true)}>
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remover ${setor.nome}`}
          disabled={pending}
          onClick={() => confirm(`Remover o setor "${setor.nome}"?`) && start(() => removerSetor(setor.id))}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </span>
    </li>
  );
}

function NovoSetor({ unidadeId }: { unidadeId: string }) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const adicionar = () =>
    start(async () => {
      const e = await salvarSetor(unidadeId, null, nome);
      setErro(e);
      if (!e) setNome("");
    });

  return (
    <div className="pt-2">
      <div className="flex gap-2">
        <Input
          aria-label="Novo setor"
          placeholder="Novo setor"
          value={nome}
          onChange={(ev) => setNome(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && (ev.preventDefault(), adicionar())}
          className="h-8"
        />
        <Button size="sm" variant="outline" onClick={adicionar} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Adicionar
        </Button>
      </div>
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

// ---------- Cartão da unidade ----------

function CartaoUnidade({ unidade, inicialAberta, onEditar }: { unidade: UnidadeComSetores; inicialAberta: boolean; onEditar: () => void }) {
  const [aberta, setAberta] = useState(inicialAberta);
  const [pending, start] = useTransition();
  const n = unidade.setores.length;

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setAberta((a) => !a)}
          aria-expanded={aberta}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !aberta && "-rotate-90")} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{unidade.nome}</span>
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              {unidade.endereco && (
                <>
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{unidade.endereco}</span>
                  <span>·</span>
                </>
              )}
              <span className="shrink-0">
                {n} {n === 1 ? "setor" : "setores"}
              </span>
            </span>
          </span>
        </button>
        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${unidade.nome}`} onClick={onEditar}>
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remover ${unidade.nome}`}
          disabled={pending}
          onClick={() =>
            confirm(`Remover a unidade "${unidade.nome}" e os seus ${n} setores?`) && start(() => removerUnidade(unidade.id))
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </div>
      {aberta && (
        <div className="border-t px-4 pt-2 pb-3 sm:pl-10">
          {n === 0 ? (
            <p className="py-1.5 text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {unidade.setores.map((s) => (
                <LinhaSetor key={s.id} setor={s} />
              ))}
            </ul>
          )}
          <NovoSetor unidadeId={unidade.id} />
        </div>
      )}
    </Card>
  );
}

// ---------- Seção ----------

export function Unidades({ clienteId, unidades }: { clienteId: string; unidades: UnidadeComSetores[] }) {
  // null = fechado; "nova" = criando; id = editando
  const [dialogo, setDialogo] = useState<string | null>(null);
  const editando = unidades.find((u) => u.id === dialogo);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Unidades e setores</h2>
          <p className="text-sm text-muted-foreground">
            O técnico escolhe a unidade e o setor no check-in. Alterações aqui são salvas na hora.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDialogo("nova")}>
          <Plus />
          Nova unidade
        </Button>
      </div>

      {unidades.length === 0 ? (
        <Card className="items-center py-10 text-center text-sm text-muted-foreground">
          Nenhuma unidade cadastrada. Cadastre ao menos uma para o cliente aparecer no check-in.
        </Card>
      ) : (
        unidades.map((u, i) => (
          <CartaoUnidade key={u.id} unidade={u} inicialAberta={i === 0} onEditar={() => setDialogo(u.id)} />
        ))
      )}

      <UnidadeDialog clienteId={clienteId} unidade={editando} aberto={dialogo !== null} onFechar={() => setDialogo(null)} />
    </section>
  );
}
