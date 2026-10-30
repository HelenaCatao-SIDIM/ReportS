"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, ExternalLink, Loader2, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { UnidadeComSetores } from "@/lib/repo/clientes";
import type { Setor } from "@/lib/types";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { cn } from "@/lib/utils";
import { removerSetor, removerUnidade, salvarSetor, salvarUnidade, type UnidadeFormState } from "../actions";
import { buscarCoordenadas, type RespostaBusca } from "../geo-actions";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ---------- Diálogo de estabelecimento (criar / editar) ----------

/** Resultado da busca de coordenadas, com o endereço que o mapa achou para a administração conferir. */
function MensagemBusca({ r, latitude, longitude }: { r: RespostaBusca; latitude: string; longitude: string }) {
  if (r.status === "ok") {
    return (
      <p role="status" className="text-xs text-emerald-800">
        Encontrado: {r.descricao || "endereço sem descrição"}. A busca acerta a rua, não a porta: confira e ajuste se precisar.{" "}
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline"
        >
          Ver no mapa
          <ExternalLink className="size-3" />
        </a>
      </p>
    );
  }
  const texto: Record<Exclude<RespostaBusca["status"], "ok">, string> = {
    nao_encontrado: "Endereço não encontrado. Inclua rua, número, cidade e UF, ou digite as coordenadas.",
    indisponivel: "O serviço de endereços não respondeu. Tente de novo em instantes ou digite as coordenadas.",
    limite: "Muitas buscas seguidas. Aguarde um minuto e tente de novo.",
    desligado: "A busca de coordenadas está desligada neste ambiente.",
  };
  return (
    <p role="status" className="text-xs text-amber-800">
      {texto[r.status]}
    </p>
  );
}

function UnidadeForm({
  clienteId,
  unidade,
  buscaAtiva,
  onSalvo,
}: {
  clienteId: string;
  unidade?: UnidadeComSetores;
  buscaAtiva: boolean;
  onSalvo: () => void;
}) {
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
    raio: String(unidade?.raioMetros ?? RAIO_PADRAO_METROS),
  };

  // Endereço e coordenadas ficam em estado para o botão poder preenchê-las; continuam editáveis.
  const [endereco, setEndereco] = useState(v.endereco);
  const [lat, setLat] = useState(v.latitude);
  const [lng, setLng] = useState(v.longitude);
  const [busca, setBusca] = useState<RespostaBusca | null>(null);
  const [buscando, iniciarBusca] = useTransition();

  const buscar = () =>
    iniciarBusca(async () => {
      const r = await buscarCoordenadas(endereco).catch((): RespostaBusca => ({ status: "indisponivel" }));
      setBusca(r);
      if (r.status === "ok") {
        setLat(String(r.latitude));
        setLng(String(r.longitude));
      }
    });

  useEffect(() => {
    if (state.ok) onSalvo();
  }, [state, onSalvo]);

  return (
    <form action={action} noValidate key={JSON.stringify(state.valores ?? null)} className="grid gap-4">
      <Campo id="u-nome" label="Nome do estabelecimento" erro={e.nome}>
        <Input id="u-nome" name="nome" defaultValue={v.nome} placeholder="Ex.: Secretaria de Saúde" className="h-9" aria-invalid={!!e.nome} />
      </Campo>
      <Campo id="u-endereco" label="Endereço" dica={buscaAtiva ? "Para a busca de coordenadas acertar, inclua número, cidade e UF." : undefined}>
        <Input id="u-endereco" name="endereco" value={endereco} onChange={(ev) => setEndereco(ev.target.value)} className="h-9" />
      </Campo>
      {buscaAtiva && (
        <div className="-mt-1 grid gap-1.5">
          <div>
            <Button type="button" size="sm" variant="outline" onClick={buscar} disabled={buscando || endereco.trim().length < 5}>
              {buscando ? <Loader2 className="animate-spin" /> : <Search />}
              Buscar coordenadas pelo endereço
            </Button>
          </div>
          {busca && <MensagemBusca r={busca} latitude={lat} longitude={lng} />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo id="u-lat" label="Latitude" erro={e.latitude}>
          <Input id="u-lat" name="latitude" inputMode="decimal" placeholder="-22.9035" value={lat} onChange={(ev) => setLat(ev.target.value)} className="h-9" aria-invalid={!!e.latitude} />
        </Campo>
        <Campo id="u-lng" label="Longitude" erro={e.longitude}>
          <Input id="u-lng" name="longitude" inputMode="decimal" placeholder="-47.0621" value={lng} onChange={(ev) => setLng(ev.target.value)} className="h-9" aria-invalid={!!e.longitude} />
        </Campo>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Latitude e longitude são opcionais. Com elas, o check-in presencial grava a distância até o estabelecimento.
      </p>
      <Campo
        id="u-raio"
        label="Raio de verificação (metros)"
        erro={e.raio}
        dica="Check-in fora do raio gera um alerta para a administração; nunca bloqueia o técnico. Comece em 50 m e ajuste pela distância real medida nas visitas."
      >
        <Input id="u-raio" name="raio" inputMode="numeric" defaultValue={v.raio} className="h-9" aria-invalid={!!e.raio} />
      </Campo>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {unidade ? "Salvar" : "Adicionar estabelecimento"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UnidadeDialog({
  clienteId,
  unidade,
  aberto,
  buscaAtiva,
  onFechar,
}: {
  clienteId: string;
  unidade?: UnidadeComSetores;
  aberto: boolean;
  buscaAtiva: boolean;
  onFechar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{unidade ? "Editar estabelecimento" : "Novo estabelecimento"}</DialogTitle>
          <DialogDescription>Local do cliente onde os atendimentos acontecem.</DialogDescription>
        </DialogHeader>
        {/* Remonta a cada abertura para começar sem erros antigos */}
        {aberto && <UnidadeForm clienteId={clienteId} unidade={unidade} buscaAtiva={buscaAtiva} onSalvo={onFechar} />}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Setores ----------

function LinhaSetor({ setor, podeEditar }: { setor: Setor; podeEditar: boolean }) {
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
      <span className={cn("flex gap-1 opacity-60 group-hover:opacity-100", !podeEditar && "hidden")}>
        <Button size="icon-sm" variant="ghost" aria-label={`Renomear ${setor.nome}`} onClick={() => setEditando(true)}>
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remover ${setor.nome}`}
          disabled={pending}
          onClick={() =>
            confirm(`Remover o setor "${setor.nome}"?`) &&
            start(async () => {
              const erro = await removerSetor(setor.id);
              if (erro) alert(erro);
            })
          }
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

// ---------- Cartão do estabelecimento ----------

function CartaoUnidade({ unidade, inicialAberta, onEditar, podeEditar }: { unidade: UnidadeComSetores; inicialAberta: boolean; onEditar: () => void; podeEditar: boolean }) {
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
        {podeEditar && (
          <>
            <Button size="icon-sm" variant="ghost" aria-label={`Editar ${unidade.nome}`} onClick={onEditar}>
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remover ${unidade.nome}`}
              disabled={pending}
              onClick={() =>
                confirm(`Remover o estabelecimento "${unidade.nome}" e os seus ${n} setores?`) &&
                start(async () => {
                  const erro = await removerUnidade(unidade.id);
                  if (erro) alert(erro);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          </>
        )}
      </div>
      {aberta && (
        <div className="border-t px-4 pt-2 pb-3 sm:pl-10">
          {n === 0 ? (
            <p className="py-1.5 text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {unidade.setores.map((s) => (
                <LinhaSetor key={s.id} setor={s} podeEditar={podeEditar} />
              ))}
            </ul>
          )}
          {podeEditar && <NovoSetor unidadeId={unidade.id} />}
        </div>
      )}
    </Card>
  );
}

// ---------- Seção ----------

/** `podeEditar`: com a permissão de cadastrar clientes; sem ela a lista é só de consulta. */
export function Unidades({ clienteId, unidades, buscaAtiva = false, podeEditar = true }: { clienteId: string; unidades: UnidadeComSetores[]; buscaAtiva?: boolean; podeEditar?: boolean }) {
  // null = fechado; "nova" = criando; id = editando
  const [dialogo, setDialogo] = useState<string | null>(null);
  const editando = unidades.find((u) => u.id === dialogo);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Estabelecimentos e setores</h2>
          <p className="text-sm text-muted-foreground">
            O técnico escolhe o estabelecimento e o setor no check-in.{podeEditar && " Alterações aqui são salvas na hora."}
          </p>
        </div>
        {podeEditar && (
          <Button variant="outline" onClick={() => setDialogo("nova")}>
            <Plus />
            Novo estabelecimento
          </Button>
        )}
      </div>

      {unidades.length === 0 ? (
        <Card className="items-center py-10 text-center text-sm text-muted-foreground">
          Nenhum estabelecimento cadastrado. É preciso ao menos um para o cliente aparecer no check-in.
        </Card>
      ) : (
        unidades.map((u, i) => (
          <CartaoUnidade key={u.id} unidade={u} inicialAberta={i === 0} onEditar={() => setDialogo(u.id)} podeEditar={podeEditar} />
        ))
      )}

      <UnidadeDialog clienteId={clienteId} unidade={editando} aberto={dialogo !== null} buscaAtiva={buscaAtiva} onFechar={() => setDialogo(null)} />
    </section>
  );
}
