"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, CloudDownload, ExternalLink, Loader2, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { UnidadeComSetores } from "@/lib/repo/clientes";
import type { Setor } from "@/lib/types";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { cn } from "@/lib/utils";
import { removerSetor, removerUnidade, salvarSetor, salvarUnidade, type UnidadeFormState } from "../actions";
import { buscarEstabelecimentosSaude, importarEstabelecimentosSaude, type BuscaSaudeState, type ResultadoImportacao } from "../saude-actions";
import type { EstabelecimentoSaude } from "@/lib/saude-estabelecimentos";
import { normalizar } from "@/lib/format";
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
              {unidade.cnes && <span className="shrink-0">CNES {unidade.cnes} ·</span>}
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

// ---------- Busca no Saúde ----------

/** Endereço da ficha do CNES; sem ela, o logradouro e o CEP que o Saúde tiver (a maioria vem vazia). */
const enderecoNaLista = (i: EstabelecimentoSaude) => i.cnesEndereco || [i.logradouro, i.cep && `CEP ${i.cep}`].filter(Boolean).join(" · ");

/** A lista que veio do Saúde: escolher o que trazer (todos marcados no começo) e importar para o cliente. */
function ListaSaude({ clienteId, itens, jaImportados }: { clienteId: string; itens: EstabelecimentoSaude[]; jaImportados: string[] }) {
  const importados = new Set(jaImportados);
  const [soComCnes, setSoComCnes] = useState(false);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState(() => new Set(itens.map((i) => i.codigo)));
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [pending, start] = useTransition();

  // "Só os com CNES" vale para a importação; a busca só filtra o que aparece (o que foi marcado continua marcado).
  const base = soComCnes ? itens.filter((i) => i.cnes) : itens;
  const termo = normalizar(busca);
  const visiveis = termo ? base.filter((i) => [i.nome, i.codigo, i.cnes, enderecoNaLista(i)].some((c) => normalizar(c).includes(termo))) : base;
  const escolhidos = base.filter((i) => marcados.has(i.codigo));
  const comCnes = itens.filter((i) => i.cnes).length;
  const todosMarcados = visiveis.length > 0 && visiveis.every((i) => marcados.has(i.codigo));

  const alternar = (codigo: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(codigo)) n.delete(codigo);
      else n.add(codigo);
      return n;
    });
  const marcarVisiveis = (sim: boolean) =>
    setMarcados((m) => {
      const n = new Set(m);
      for (const i of visiveis) {
        if (sim) n.add(i.codigo);
        else n.delete(i.codigo);
      }
      return n;
    });
  const importar = () =>
    start(async () => {
      setResultado(await importarEstabelecimentosSaude(clienteId, escolhidos).catch((): ResultadoImportacao => ({ ok: false, erro: "Não foi possível importar. Tente de novo." })));
    });

  if (resultado?.ok) {
    return (
      <div className="grid gap-2 text-sm">
        <p className="flex items-center gap-2 font-medium text-emerald-800">
          <Check className="size-4" />
          Importação concluída: {resultado.incluidos} {resultado.incluidos === 1 ? "incluído" : "incluídos"} e {resultado.atualizados}{" "}
          {resultado.atualizados === 1 ? "atualizado" : "atualizados"}.
        </p>
        <p className="text-muted-foreground">Os estabelecimentos já aparecem na lista do cliente. Ajuste a localização e o raio de cada um quando precisar.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          <span className="font-medium">{itens.length} no Saúde</span> · {comCnes} com CNES · {itens.length - comCnes} sem CNES
          {importados.size > 0 && ` · ${itens.filter((i) => importados.has(i.codigo)).length} já importados`}
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-primary" checked={soComCnes} onChange={(ev) => setSoComCnes(ev.target.checked)} />
          Só os com CNES
        </label>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar estabelecimento"
          placeholder="Buscar por nome, endereço, código ou CNES"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          className="h-9 pl-8"
        />
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Marcar todos"
                  className="size-4 accent-primary"
                  checked={todosMarcados}
                  onChange={(ev) => marcarVisiveis(ev.target.checked)}
                />
              </th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Endereço</th>
              <th className="px-3 py-2 font-medium">CNES</th>
              <th className="px-3 py-2 font-medium">Município (IBGE)</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum estabelecimento encontrado.
                </td>
              </tr>
            )}
            {visiveis.map((i) => (
              <tr key={i.codigo} className="cursor-pointer hover:bg-muted/50" onClick={() => alternar(i.codigo)}>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    aria-label={`Importar ${i.nome}`}
                    className="size-4 accent-primary"
                    checked={marcados.has(i.codigo)}
                    onChange={() => alternar(i.codigo)}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{i.codigo}</td>
                <td className="px-3 py-1.5">
                  {i.nome}
                  {i.cnesNome && normalizar(i.cnesNome) !== normalizar(i.nome) && (
                    <span className="block text-xs text-muted-foreground">No CNES: {i.cnesNome}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {enderecoNaLista(i) || "—"}
                  {i.latitude !== null && (
                    <span className="flex items-center gap-0.5 text-xs text-emerald-700">
                      <MapPin className="size-3" />
                      com localização
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 tabular-nums">{i.cnes || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.municipio || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-1.5 text-xs">
                  {importados.has(i.codigo) ? <span className="text-muted-foreground">Já importado</span> : <span className="text-emerald-700">Novo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resultado && !resultado.ok && (
        <p role="alert" className="text-sm text-destructive">
          {resultado.erro}
        </p>
      )}
      <DialogFooter>
        <Button onClick={importar} disabled={pending || escolhidos.length === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <CloudDownload />}
          Importar {escolhidos.length} {escolhidos.length === 1 ? "selecionado" : "selecionados"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Pede um usuário e uma senha do Saúde e mostra, só para ver, os estabelecimentos cadastrados lá. Não grava nada. */
function BuscaSaude({ clienteId }: { clienteId: string }) {
  const [state, action, pending] = useActionState<BuscaSaudeState, FormData>(buscarEstabelecimentosSaude.bind(null, clienteId), {});
  const e = state.erros ?? {};

  if (state.itens) return <ListaSaude clienteId={clienteId} itens={state.itens} jaImportados={state.jaImportados ?? []} />;

  return (
    <form action={action} noValidate className="grid gap-4">
      <Campo id="s-usuario" label="Usuário do Saúde" erro={e.usuario}>
        <Input id="s-usuario" name="usuario" defaultValue={state.usuario ?? ""} autoComplete="off" className="h-9" aria-invalid={!!e.usuario} />
      </Campo>
      <Campo id="s-senha" label="Senha" erro={e.senha} dica="Usada só para buscar a lista. O ReportS não guarda a senha.">
        <Input id="s-senha" name="senha" type="password" autoComplete="off" className="h-9" aria-invalid={!!e.senha} />
      </Campo>
      {e.geral && (
        <p role="alert" className="text-sm text-destructive">
          {e.geral}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CloudDownload />}
          Buscar
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------- Seção ----------

/**
 * `podeEditar`: com a permissão de cadastrar clientes; sem ela a lista é só de consulta.
 * `temSaude`: o cliente tem o sistema Saúde, então dá para buscar os estabelecimentos cadastrados lá.
 */
export function Unidades({
  clienteId,
  unidades,
  buscaAtiva = false,
  podeEditar = true,
  temSaude = false,
}: {
  clienteId: string;
  unidades: UnidadeComSetores[];
  buscaAtiva?: boolean;
  podeEditar?: boolean;
  temSaude?: boolean;
}) {
  // null = fechado; "nova" = criando; id = editando
  const [dialogo, setDialogo] = useState<string | null>(null);
  const [buscandoSaude, setBuscandoSaude] = useState(false);
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
          <div className="flex flex-wrap gap-2">
            {temSaude && (
              <Button variant="outline" onClick={() => setBuscandoSaude(true)}>
                <CloudDownload />
                Buscar do Saúde
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogo("nova")}>
              <Plus />
              Novo estabelecimento
            </Button>
          </div>
        )}
      </div>

      <Dialog open={buscandoSaude} onOpenChange={setBuscandoSaude}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Buscar estabelecimentos do Saúde</DialogTitle>
            <DialogDescription>Entre com um usuário do Saúde deste cliente para ver os estabelecimentos cadastrados lá.</DialogDescription>
          </DialogHeader>
          {/* Remonta a cada abertura: começa de novo, sem a lista nem o usuário da vez anterior */}
          {buscandoSaude && <BuscaSaude clienteId={clienteId} />}
        </DialogContent>
      </Dialog>

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
