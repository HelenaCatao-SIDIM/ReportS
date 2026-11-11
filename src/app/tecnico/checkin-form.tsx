"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, Clock, Loader2, LocateFixed, MapPin, Monitor } from "lucide-react";
import type { ClienteCheckin } from "@/lib/repo/contratos";
import type { MeioRegistro, TipoVisita } from "@/lib/types";
import { detectarMeio } from "@/lib/meio";
import { chaveRascunhoCheckin, sugereTemasPorEquipe } from "@/lib/regras-visita";
import type { PendenciaCronograma } from "@/lib/cronograma";
import { ehPresencial, TIPOS_VISITA } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { fazerCheckin, type CheckinState } from "./actions";
import { useAcao } from "@/components/form/use-acao";
import { selectClass } from "@/components/form/campo";
import { PendenciasCronograma } from "@/components/cronograma/pendencias-cronograma";
import { FotoCampo } from "@/components/tecnico/foto-campo";
import { guardarRascunho, lerRascunho } from "@/components/tecnico/rascunho";
import { useGps } from "@/components/tecnico/use-gps";
import { usePreviaCep } from "@/components/tecnico/use-previa-cep";
import { TextoLocal } from "@/components/tecnico/texto-local";
import { formatarCep } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

const select = cn(selectClass, "h-11 bg-background text-base");

// O aparelho só é conhecido no navegador; no servidor fica vazio e o valor entra após a hidratação.
const semAssinatura = () => () => {};
const meioNoNavegador = (): MeioRegistro | null => detectarMeio();
const meioNoServidor = (): MeioRegistro | null => null;

/** O que o técnico já tinha escolhido no check-in. A foto e a localização não são guardadas: são pedidas de novo. */
interface RascunhoCheckin {
  clienteId: string;
  /** Contrato (sistema). Rascunhos antigos não têm. */
  contratoId?: string;
  unidadeId: string;
  /** Equipes marcadas. Rascunhos antigos (do tempo do setor) não têm. */
  equipeIds?: string[];
  tipo: TipoVisita | "";
  link: string;
}

function Erro({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-destructive">{msg}</p> : null;
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{numero}</span>
          {titulo}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

/** Linhas escritas no rodapé da foto do ambiente (nunca coordenadas). */
function linhasCarimbo(cep: string | null, cidade: string | null, uf: string | null) {
  const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date());
  const local = cep ? `CEP ${formatarCep(cep)} (aprox.)${cidade ? ` · ${[cidade, uf].filter(Boolean).join("/")}` : ""}` : "CEP não identificado";
  return [quando, local];
}

export function CheckinForm({
  clientes,
  equipes = [],
  cronograma = [],
  porCep = false,
  carimbo = false,
}: {
  clientes: ClienteCheckin[];
  /** Equipes ativas, que podem ser marcadas. */
  equipes?: { id: string; nome: string }[];
  cronograma?: PendenciaCronograma[];
  porCep?: boolean;
  carimbo?: boolean;
}) {
  const [state, onSubmit, pending] = useAcao<CheckinState>(fazerCheckin, {});
  const e = state.erros ?? {};

  const [clienteId, setClienteId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [equipeIds, setEquipeIds] = useState<string[]>([]);
  const [tipo, setTipo] = useState<TipoVisita | "">("");
  /** Visita prevista no cronograma que o técnico escolheu (preenche a atividade e as equipes). */
  const [previstaId, setPrevistaId] = useState<string | null>(null);
  const [temFoto, setTemFoto] = useState(false);
  const [link, setLink] = useState("");
  const { estado: gps, capturar } = useGps();
  const meio = useSyncExternalStore(semAssinatura, meioNoNavegador, meioNoServidor);
  const restaurado = useRef(false);

  // Ao reabrir a tela (aba fechada, celular travado), devolve o que já tinha sido escolhido.
  useEffect(() => {
    if (restaurado.current) return;
    const t = setTimeout(() => {
      const r = lerRascunho<RascunhoCheckin>(chaveRascunhoCheckin);
      const c = clientes.find((x) => x.id === r?.clienteId);
      if (r && c) {
        const u = c.unidades.find((x) => x.id === r.unidadeId);
        // Sistema com um só contrato já vem escolhido.
        const ct = c.contratos.find((x) => x.id === r.contratoId) ?? (c.contratos.length === 1 ? c.contratos[0] : undefined);
        const tipoValido = TIPOS_VISITA.find((x) => x.valor === r.tipo);
        setClienteId(c.id);
        setContratoId(ct?.id ?? "");
        setUnidadeId(u?.id ?? "");
        setEquipeIds((r.equipeIds ?? []).filter((id) => equipes.some((e) => e.id === id)));
        if (tipoValido) {
          setTipo(tipoValido.valor);
          if (tipoValido.presencial) capturar();
          else setLink(r.link);
        }
      }
      restaurado.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [clientes, equipes, capturar]);

  // Guarda as escolhas a cada mudança, só depois da recuperação (senão apagaria o rascunho ao abrir).
  useEffect(() => {
    if (!restaurado.current) return;
    guardarRascunho(chaveRascunhoCheckin, { clienteId, contratoId, unidadeId, equipeIds, tipo, link } satisfies RascunhoCheckin);
  }, [clienteId, contratoId, unidadeId, equipeIds, tipo, link]);
  const previa = usePreviaCep(gps, porCep);
  const p = previa.fase === "pronto" ? previa.previa : null;

  const cliente = clientes.find((c) => c.id === clienteId);
  const unidade = cliente?.unidades.find((u) => u.id === unidadeId);
  const presencial = tipo ? ehPresencial(tipo) : null;

  const contrato = cliente?.contratos.find((k) => k.id === contratoId);
  // No lugar do setor: as equipes que vão ser treinadas (implantação e treinamentos). Obrigatórias quando há equipe cadastrada.
  const opcoesEquipe = contrato && tipo && sugereTemasPorEquipe(tipo) ? equipes : [];
  const equipesOk = !opcoesEquipe.length || equipeIds.some((id) => opcoesEquipe.some((e) => e.id === id));
  const localOk = !!clienteId && !!contratoId && !!unidadeId && equipesOk;
  const alternarEquipe = (id: string) => setEquipeIds((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  const comprovacaoOk = presencial === null ? false : presencial ? gps.fase === "ok" && temFoto : temFoto && !!link.trim();
  const pronto = localOk && comprovacaoOk;

  function escolherTipo(t: TipoVisita) {
    setTipo(t);
    setTemFoto(false);
    // Presencial: já pede a localização para ganhar tempo.
    if (ehPresencial(t) && gps.fase === "parado") capturar();
  }

  const previstasDe = (cId: string, uId: string) => cronograma.filter((i) => i.contratoId === cId && i.unidadeId === uId);

  /** Escolhe a visita prevista: a atividade e as equipes dela vêm preenchidas (o técnico ainda pode ajustar). null = desfaz. */
  function escolherPrevista(item: PendenciaCronograma | null) {
    const anterior = cronograma.find((i) => i.id === previstaId);
    setPrevistaId(item?.id ?? null);
    if (!item) {
      // Desfazer a escolha tira as equipes que vieram da visita prevista (as que o técnico marcou à parte ficam).
      if (anterior) setEquipeIds((atuais) => atuais.filter((id) => !anterior.equipeIds.includes(id)));
      return;
    }
    if (tipo !== item.tipo) escolherTipo(item.tipo);
    setEquipeIds(item.equipeIds.filter((id) => equipes.some((e) => e.id === id)));
  }

  /** Ao chegar num estabelecimento com uma só visita prevista para hoje, ela já vem escolhida. */
  function aoMudarLocal(cId: string, uId: string) {
    setPrevistaId(null);
    setEquipeIds([]);
    const deHoje = previstasDe(cId, uId).filter((i) => i.diasParaPrazo === 0);
    if (deHoje.length === 1) escolherPrevista(deHoje[0]);
  }

  if (!clientes.length) {
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>Nenhum cliente disponível para check-in. Fale com a coordenação.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="meio" value={meio ?? ""} />
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}

      <Secao numero={1} titulo="Onde você está">
        <div>
          <Label htmlFor="clienteId" className="mb-1.5">
            Cliente
          </Label>
          <select
            id="clienteId"
            name="clienteId"
            value={clienteId}
            onChange={(ev) => {
              setClienteId(ev.target.value);
              const c = clientes.find((x) => x.id === ev.target.value);
              // Sistema e estabelecimento únicos já vêm escolhidos.
              const cId = c?.contratos.length === 1 ? c.contratos[0].id : "";
              const uId = c?.unidades.length === 1 ? c.unidades[0].id : "";
              setContratoId(cId);
              setUnidadeId(uId);
              aoMudarLocal(cId, uId);
            }}
            className={select}
          >
            <option value="">Escolha o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <Erro msg={e.cliente} />
        </div>
        <div>
          <Label htmlFor="contratoId" className="mb-1.5">
            Sistema
          </Label>
          <select id="contratoId" name="contratoId" value={contratoId} disabled={!cliente} onChange={(ev) => {
              setContratoId(ev.target.value);
              aoMudarLocal(ev.target.value, unidadeId);
            }} className={select}>
            <option value="">{cliente ? "Escolha o sistema" : "Escolha o cliente primeiro"}</option>
            {cliente?.contratos.map((k) => (
              <option key={k.id} value={k.id}>
                {k.sistemaNome}
              </option>
            ))}
          </select>
          <Erro msg={e.contrato} />
        </div>
        <div>
          <Label htmlFor="unidadeId" className="mb-1.5">
            Estabelecimento
          </Label>
          <select
            id="unidadeId"
            name="unidadeId"
            value={unidadeId}
            disabled={!cliente}
            onChange={(ev) => {
              setUnidadeId(ev.target.value);
              aoMudarLocal(contratoId, ev.target.value);
            }}
            className={select}
          >
            <option value="">{cliente ? "Escolha o estabelecimento" : "Escolha o cliente primeiro"}</option>
            {cliente?.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          {unidade?.endereco && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {unidade.endereco}
            </p>
          )}
          {contratoId && unidade && <PendenciasCronograma itens={previstasDe(contratoId, unidade.id)} escolhidoId={previstaId} onEscolher={escolherPrevista} />}
          <Erro msg={e.unidade} />
        </div>
      </Secao>

      <Secao numero={2} titulo="Tipo de visita">
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_VISITA.map((t) => (
            <label
              key={t.valor}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm transition-colors",
                tipo === t.valor ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
              )}
            >
              <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => {
                  escolherTipo(t.valor);
                  // Outra atividade: deixa de ser a visita prevista escolhida.
                  if (cronograma.find((i) => i.id === previstaId)?.tipo !== t.valor) setPrevistaId(null);
                }} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
        <Erro msg={e.tipo} />
        {opcoesEquipe.length > 0 && (
          <fieldset className="space-y-2 pt-1">
            <legend className="mb-1.5 text-sm font-medium">Equipes que vão ser treinadas</legend>
            <div className="grid gap-2">
              {opcoesEquipe.map((eq) => {
                const marcada = equipeIds.includes(eq.id);
                return (
                  <label
                    key={eq.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm transition-colors",
                      marcada ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
                    )}
                  >
                    <input type="checkbox" name="equipeIds" value={eq.id} checked={marcada} onChange={() => alternarEquipe(eq.id)} className="size-4 accent-primary" />
                    {eq.nome}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Dá para mudar durante a visita, até o check-out.</p>
            <Erro msg={e.equipes} />
          </fieldset>
        )}
      </Secao>

      {presencial === true && meio === "computador" && (
        <Alert>
          <Monitor />
          <AlertDescription>
            Você está no computador. Em visita presencial, o ideal é fazer o check-in pelo celular: a localização do computador costuma ser pouco precisa. Você
            pode continuar; o relatório mostrará que o registro foi feito pelo computador.
          </AlertDescription>
        </Alert>
      )}

      {presencial === true && (
        <Secao numero={3} titulo="Comprovação no local">
          <div className="rounded-lg border p-3">
            <input type="hidden" name="latitude" value={gps.fase === "ok" ? gps.latitude : ""} />
            <input type="hidden" name="longitude" value={gps.fase === "ok" ? gps.longitude : ""} />
            <input type="hidden" name="precisao" value={gps.fase === "ok" ? gps.precisao : ""} />
            <input type="hidden" name="capturadoEm" value={gps.fase === "ok" ? gps.capturadoEm : ""} />
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  gps.fase === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                )}
              >
                {gps.fase === "buscando" ? <Loader2 className="size-4 animate-spin" /> : gps.fase === "ok" ? <Check className="size-4" /> : <LocateFixed className="size-4" />}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium">Localização</div>
                {gps.fase === "parado" && <p className="text-xs text-muted-foreground">Registrada só agora e no check-out.</p>}
                {gps.fase === "buscando" && <p className="text-xs text-muted-foreground">Obtendo a localização…</p>}
                {gps.fase === "ok" && <TextoLocal gps={gps} porCep={porCep} previa={previa} />}
                {gps.fase === "erro" && <p className="text-xs text-destructive">{gps.mensagem}</p>}
              </div>
              {(gps.fase === "parado" || gps.fase === "erro") && (
                <Button type="button" size="sm" variant="outline" onClick={capturar}>
                  {gps.fase === "erro" ? "Tentar de novo" : "Capturar"}
                </Button>
              )}
            </div>
            <Erro msg={e.gps} />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">Foto do ambiente</div>
            <FotoCampo
              key={`foto-${tipo}`}
              name="fotoAmbiente"
              rotulo="Foto do ambiente"
              invalido={!!e.foto}
              onMudar={setTemFoto}
              carimbo={carimbo ? () => linhasCarimbo(p?.status === "ok" ? p.cep : null, p?.cidade ?? null, p?.uf ?? null) : undefined}
            />
            <Erro msg={e.foto} />
          </div>
        </Secao>
      )}

      {presencial === false && (
        <Secao numero={3} titulo="Comprovação da reunião online">
          <div>
            <Label htmlFor="linkReuniao" className="mb-1.5">
              Link da reunião
            </Label>
            <Input
              id="linkReuniao"
              name="linkReuniao"
              type="url"
              inputMode="url"
              value={link}
              onChange={(ev) => setLink(ev.target.value)}
              placeholder="https://"
              className="h-11 text-base"
              aria-invalid={!!e.link}
            />
            <Erro msg={e.link} />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">Print da tela</div>
            <FotoCampo key={`print-${tipo}`} name="printTela" origem="galeria" rotulo="Print da tela" invalido={!!e.print} onMudar={setTemFoto} />
            <Erro msg={e.print} />
          </div>
        </Secao>
      )}

      <div className="space-y-2 pb-2">
        <Button type="submit" disabled={!pronto || pending} className="h-12 w-full text-base">
          {pending ? <Loader2 className="animate-spin" /> : <Clock />}
          Fazer check-in
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {pronto ? "A data e a hora de entrada são registradas pelo servidor." : "Preencha os passos acima para liberar o check-in."}
        </p>
      </div>
    </form>
  );
}
