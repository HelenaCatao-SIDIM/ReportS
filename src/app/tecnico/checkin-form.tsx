"use client";

import { useState } from "react";
import { AlertCircle, Check, Clock, Loader2, LocateFixed, MapPin } from "lucide-react";
import type { ClienteCheckin } from "@/lib/repo/clientes";
import type { TipoVisita } from "@/lib/types";
import { ehPresencial, TIPOS_VISITA } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { fazerCheckin, type CheckinState } from "./actions";
import { useAcao } from "@/components/form/use-acao";
import { selectClass } from "@/components/form/campo";
import { FotoCampo } from "@/components/tecnico/foto-campo";
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
  const local = cep ? `CEP ${formatarCep(cep)}${cidade ? ` · ${[cidade, uf].filter(Boolean).join("/")}` : ""}` : "CEP não identificado";
  return [quando, local];
}

export function CheckinForm({ clientes, porCep = false, carimbo = false }: { clientes: ClienteCheckin[]; porCep?: boolean; carimbo?: boolean }) {
  const [state, onSubmit, pending] = useAcao<CheckinState>(fazerCheckin, {});
  const e = state.erros ?? {};

  const [clienteId, setClienteId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [setor, setSetor] = useState("");
  const [setorOutro, setSetorOutro] = useState("");
  const [tipo, setTipo] = useState<TipoVisita | "">("");
  const [temFoto, setTemFoto] = useState(false);
  const [link, setLink] = useState("");
  const { estado: gps, capturar } = useGps();
  const previa = usePreviaCep(gps, porCep);
  const p = previa.fase === "pronto" ? previa.previa : null;

  const cliente = clientes.find((c) => c.id === clienteId);
  const unidade = cliente?.unidades.find((u) => u.id === unidadeId);
  const presencial = tipo ? ehPresencial(tipo) : null;

  const localOk = !!clienteId && !!unidadeId && (setor === "outro" ? !!setorOutro.trim() : !!setor);
  const comprovacaoOk = presencial === null ? false : presencial ? gps.fase === "ok" && temFoto : temFoto && !!link.trim();
  const pronto = localOk && comprovacaoOk;

  function escolherTipo(t: TipoVisita) {
    setTipo(t);
    setTemFoto(false);
    // Presencial: já pede a localização para ganhar tempo.
    if (ehPresencial(t) && gps.fase === "parado") capturar();
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
              // Unidade única já vem escolhida.
              setUnidadeId(c?.unidades.length === 1 ? c.unidades[0].id : "");
              setSetor("");
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
          <Label htmlFor="unidadeId" className="mb-1.5">
            Unidade
          </Label>
          <select
            id="unidadeId"
            name="unidadeId"
            value={unidadeId}
            disabled={!cliente}
            onChange={(ev) => {
              setUnidadeId(ev.target.value);
              setSetor("");
            }}
            className={select}
          >
            <option value="">{cliente ? "Escolha a unidade" : "Escolha o cliente primeiro"}</option>
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
          <Erro msg={e.unidade} />
        </div>
        <div>
          <Label htmlFor="setorId" className="mb-1.5">
            Setor
          </Label>
          <select id="setorId" name="setorId" value={setor} disabled={!unidade} onChange={(ev) => setSetor(ev.target.value)} className={select}>
            <option value="">{unidade ? "Escolha o setor" : "Escolha a unidade primeiro"}</option>
            {unidade?.setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
            {unidade && <option value="outro">Outro (digitar)</option>}
          </select>
          {setor === "outro" && (
            <Input
              name="setorOutro"
              value={setorOutro}
              onChange={(ev) => setSetorOutro(ev.target.value)}
              placeholder="Nome do setor"
              aria-label="Nome do setor"
              className="mt-2 h-11 text-base"
            />
          )}
          <Erro msg={e.setor} />
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
              <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => escolherTipo(t.valor)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
        <Erro msg={e.tipo} />
      </Secao>

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
