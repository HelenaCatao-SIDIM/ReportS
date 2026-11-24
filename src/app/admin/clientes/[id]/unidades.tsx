"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, CloudDownload, ExternalLink, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Unidade } from "@/lib/types";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { removerUnidade, salvarUnidade, type UnidadeFormState } from "../actions";
import { buscarEstabelecimentosSaude, importarEstabelecimentosSaude, type BuscaSaudeState, type ResultadoImportacao } from "../saude-actions";
import { buscarEstabelecimentosCnes, importarEstabelecimentosCnes, municipioDoClienteCnes, municipiosDoEstado, type BuscaCnesState, type ResultadoImportacaoCnes } from "../cnes-actions";
import type { EstabelecimentoSaude } from "@/lib/saude-estabelecimentos";
import type { EstabelecimentoCnes } from "@/lib/cnes";
import { normalizar } from "@/lib/format";
import { buscarCoordenadas, type RespostaBusca } from "../geo-actions";
import { Campo, selectClass } from "@/components/form/campo";
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
  unidade?: Unidade;
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
  unidade?: Unidade;
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

// ---------- Cartão do estabelecimento ----------

function CartaoUnidade({ unidade, onEditar, podeEditar }: { unidade: Unidade; onEditar: () => void; podeEditar: boolean }) {
  const [pending, start] = useTransition();

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 p-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{unidade.nome}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {unidade.endereco && (
              <>
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{unidade.endereco}</span>
              </>
            )}
            {unidade.cnes && <span className="shrink-0">{unidade.endereco && "· "}CNES {unidade.cnes}</span>}
          </span>
        </span>
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
                confirm(`Remover o estabelecimento "${unidade.nome}"?`) &&
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

// ---------- Busca no CNES (rede da prefeitura) ----------

/** As 27 UFs, em ordem de nome (dado estático; a lista de municípios vem do servidor ao escolher o estado). */
const ESTADOS_UF: { uf: string; nome: string }[] = [
  { uf: "AC", nome: "Acre" }, { uf: "AL", nome: "Alagoas" }, { uf: "AP", nome: "Amapá" }, { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" }, { uf: "CE", nome: "Ceará" }, { uf: "DF", nome: "Distrito Federal" }, { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" }, { uf: "MA", nome: "Maranhão" }, { uf: "MT", nome: "Mato Grosso" }, { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" }, { uf: "PA", nome: "Pará" }, { uf: "PB", nome: "Paraíba" }, { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" }, { uf: "PI", nome: "Piauí" }, { uf: "RJ", nome: "Rio de Janeiro" }, { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" }, { uf: "RO", nome: "Rondônia" }, { uf: "RR", nome: "Roraima" }, { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" }, { uf: "SE", nome: "Sergipe" }, { uf: "TO", nome: "Tocantins" },
];

/** A lista que veio do CNES: marcar o que trazer e importar. Endereço e localização vêm na importação (da ficha do CNES). */
function ListaCnes({ clienteId, municipioIbge, municipioNome, itens, jaImportados }: { clienteId: string; municipioIbge: string; municipioNome: string; itens: EstabelecimentoCnes[]; jaImportados: string[] }) {
  const importados = new Set(jaImportados);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState(() => new Set(itens.map((i) => i.cnes)));
  const [resultado, setResultado] = useState<ResultadoImportacaoCnes | null>(null);
  const [pending, start] = useTransition();

  const termo = normalizar(busca);
  const visiveis = termo ? itens.filter((i) => [i.nome, i.cnes].some((c) => normalizar(c).includes(termo))) : itens;
  const escolhidos = itens.filter((i) => marcados.has(i.cnes));
  const novos = itens.filter((i) => !importados.has(i.cnes)).length;
  const todosMarcados = visiveis.length > 0 && visiveis.every((i) => marcados.has(i.cnes));

  const alternar = (cnes: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(cnes)) n.delete(cnes);
      else n.add(cnes);
      return n;
    });
  const marcarVisiveis = (sim: boolean) =>
    setMarcados((m) => {
      const n = new Set(m);
      for (const i of visiveis) {
        if (sim) n.add(i.cnes);
        else n.delete(i.cnes);
      }
      return n;
    });
  const importar = () =>
    start(async () => {
      setResultado(await importarEstabelecimentosCnes(clienteId, municipioIbge, escolhidos.map((i) => ({ cnes: i.cnes, nome: i.nome }))).catch((): ResultadoImportacaoCnes => ({ ok: false, erro: "Não foi possível importar. Tente de novo." })));
    });

  if (resultado?.ok) {
    return (
      <div className="grid gap-2 text-sm">
        <p className="flex items-center gap-2 font-medium text-emerald-800">
          <Check className="size-4" />
          Importação concluída: {resultado.incluidos} {resultado.incluidos === 1 ? "incluído" : "incluídos"} e {resultado.atualizados} {resultado.atualizados === 1 ? "atualizado" : "atualizados"}.
        </p>
        <p className="text-muted-foreground">Os estabelecimentos já aparecem na lista do cliente, com endereço e localização do CNES. Ajuste o raio de cada um quando precisar.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        <span className="font-medium">{itens.length} na rede municipal de {municipioNome || municipioIbge}</span> (gestão municipal) · {novos} novos · {itens.length - novos} já importados
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar estabelecimento" placeholder="Buscar por nome ou CNES" value={busca} onChange={(ev) => setBusca(ev.target.value)} className="h-9 pl-8" />
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" aria-label="Marcar todos" className="size-4 accent-primary" checked={todosMarcados} onChange={(ev) => marcarVisiveis(ev.target.checked)} />
              </th>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">CNES</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum estabelecimento encontrado.
                </td>
              </tr>
            )}
            {visiveis.map((i) => (
              <tr key={i.cnes} className="cursor-pointer hover:bg-muted/50" onClick={() => alternar(i.cnes)}>
                <td className="px-3 py-1.5">
                  <input type="checkbox" aria-label={`Importar ${i.nome}`} className="size-4 accent-primary" checked={marcados.has(i.cnes)} onChange={() => alternar(i.cnes)} onClick={(ev) => ev.stopPropagation()} />
                </td>
                <td className="px-3 py-1.5">{i.nome}</td>
                <td className="px-3 py-1.5 tabular-nums">{i.cnes}</td>
                <td className="px-3 py-1.5 text-xs">
                  {importados.has(i.cnes) ? <span className="text-muted-foreground">Já importado</span> : <span className="text-emerald-700">Novo</span>}
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
      {pending && <p className="text-xs text-muted-foreground">Buscando endereço e localização de cada um no CNES — pode levar alguns segundos.</p>}
    </div>
  );
}

/** Escolhe Estado → Município e busca no CNES a rede de gestão municipal (natureza pública) daquela cidade. */
function BuscaCnes({ clienteId }: { clienteId: string }) {
  const [uf, setUf] = useState("");
  const [municipios, setMunicipios] = useState<{ codigo: string; nome: string }[]>([]);
  const [municipio, setMunicipio] = useState("");
  const [carregandoMun, carregarMun] = useTransition();
  const [resultado, setResultado] = useState<BuscaCnesState | null>(null);
  const [buscando, iniciarBusca] = useTransition();
  // Autodetecção pelo nome do cliente: `detectando` enquanto procura; `sugerido` o município achado; `manual` quando o admin escolhe à mão.
  const [sugerido, setSugerido] = useState<{ codigo: string; nome: string; uf: string } | null>(null);
  const [detectando, setDetectando] = useState(true);
  const [manual, setManual] = useState(false);
  const detectou = useRef(false);

  const rodarBusca = (codigo: string) =>
    iniciarBusca(async () => setResultado(await buscarEstabelecimentosCnes(clienteId, codigo).catch((): BuscaCnesState => ({ ok: false, erro: "Não foi possível buscar agora. Tente de novo." }))));

  // Ao abrir: deduz o município pelo nome do cliente e já busca. Sem dedução, cai no seletor.
  useEffect(() => {
    if (detectou.current) return;
    detectou.current = true;
    municipioDoClienteCnes(clienteId)
      .then((m) => {
        setDetectando(false);
        if (!m) return;
        setSugerido(m);
        iniciarBusca(async () => setResultado(await buscarEstabelecimentosCnes(clienteId, m.codigo).catch((): BuscaCnesState => ({ ok: false, erro: "Não foi possível buscar agora. Tente de novo." }))));
      })
      .catch(() => setDetectando(false));
  }, [clienteId]);

  function escolherUf(novo: string) {
    setUf(novo);
    setMunicipio("");
    setMunicipios([]);
    setResultado(null);
    if (novo) carregarMun(async () => setMunicipios(await municipiosDoEstado(novo).catch(() => [])));
  }

  if (resultado?.ok) {
    return <ListaCnes clienteId={clienteId} municipioIbge={resultado.municipioIbge} municipioNome={resultado.municipioNome} itens={resultado.itens} jaImportados={resultado.jaImportados} />;
  }

  if (detectando) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Identificando o município do cliente…
      </p>
    );
  }

  // Deduziu pelo nome e o admin não pediu para trocar: mostra o município e o andamento da busca.
  if (sugerido && !manual) {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          Município do cliente: <span className="font-medium">{sugerido.nome} ({sugerido.uf})</span>.{" "}
          <button type="button" onClick={() => { setManual(true); setResultado(null); escolherUf(sugerido.uf); }} className="text-primary underline">
            Trocar município
          </button>
        </p>
        {buscando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando a rede de {sugerido.nome} no CNES…
          </p>
        )}
        {resultado && !resultado.ok && (
          <div className="grid gap-2">
            <p role="alert" className="text-sm text-destructive">{resultado.erro}</p>
            <div>
              <Button variant="outline" size="sm" onClick={() => rodarBusca(sugerido.codigo)} disabled={buscando}>
                Tentar de novo
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Seletor manual: sem dedução, ou o admin pediu para trocar.
  return (
    <div className="grid gap-4">
      {!manual && <p className="text-sm text-muted-foreground">Não deu para identificar o município pelo nome do cliente. Escolha abaixo.</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo id="c-uf" label="Estado">
          <select id="c-uf" value={uf} onChange={(ev) => escolherUf(ev.target.value)} className={selectClass}>
            <option value="">Escolha o estado</option>
            {ESTADOS_UF.map((e) => (
              <option key={e.uf} value={e.uf}>
                {e.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="c-mun" label="Município" dica={carregandoMun ? "Carregando municípios…" : undefined}>
          <select id="c-mun" value={municipio} disabled={!municipios.length} onChange={(ev) => setMunicipio(ev.target.value)} className={selectClass}>
            <option value="">{uf ? (carregandoMun ? "Carregando…" : "Escolha o município") : "Escolha o estado primeiro"}</option>
            {municipios.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">Traz a rede própria da prefeitura (gestão municipal e natureza pública) daquele município, direto do CNES.</p>
      {resultado && !resultado.ok && (
        <p role="alert" className="text-sm text-destructive">
          {resultado.erro}
        </p>
      )}
      <DialogFooter>
        <Button onClick={() => municipio && rodarBusca(municipio)} disabled={!municipio || buscando}>
          {buscando ? <Loader2 className="animate-spin" /> : <CloudDownload />}
          Buscar
        </Button>
      </DialogFooter>
    </div>
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
  unidades: Unidade[];
  buscaAtiva?: boolean;
  podeEditar?: boolean;
  temSaude?: boolean;
}) {
  // null = fechado; "nova" = criando; id = editando
  const [dialogo, setDialogo] = useState<string | null>(null);
  const [buscandoSaude, setBuscandoSaude] = useState(false);
  const [buscandoCnes, setBuscandoCnes] = useState(false);
  const editando = unidades.find((u) => u.id === dialogo);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Estabelecimentos</h2>
          <p className="text-sm text-muted-foreground">
            O técnico escolhe o estabelecimento no check-in.{podeEditar && " Alterações aqui são salvas na hora."}
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
            <Button variant="outline" onClick={() => setBuscandoCnes(true)}>
              <CloudDownload />
              Buscar do CNES
            </Button>
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

      <Dialog open={buscandoCnes} onOpenChange={setBuscandoCnes}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Buscar estabelecimentos do CNES</DialogTitle>
            <DialogDescription>Escolha o estado e o município para trazer a rede própria da prefeitura (gestão municipal), direto do CNES.</DialogDescription>
          </DialogHeader>
          {buscandoCnes && <BuscaCnes clienteId={clienteId} />}
        </DialogContent>
      </Dialog>

      {unidades.length === 0 ? (
        <Card className="items-center py-10 text-center text-sm text-muted-foreground">
          Nenhum estabelecimento cadastrado. É preciso ao menos um para o cliente aparecer no check-in.
        </Card>
      ) : (
        unidades.map((u) => (
          <CartaoUnidade key={u.id} unidade={u} onEditar={() => setDialogo(u.id)} podeEditar={podeEditar} />
        ))
      )}

      <UnidadeDialog clienteId={clienteId} unidade={editando} aberto={dialogo !== null} buscaAtiva={buscaAtiva} onFechar={() => setDialogo(null)} />
    </section>
  );
}
