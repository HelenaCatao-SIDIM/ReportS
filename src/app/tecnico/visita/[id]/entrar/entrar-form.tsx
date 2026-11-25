"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { AlertCircle, Check, Clock, Loader2, LocateFixed } from "lucide-react";
import type { MeioRegistro } from "@/lib/types";
import { detectarMeio } from "@/lib/meio";
import { cn } from "@/lib/utils";
import { entrarNaVisita, type EntrarState } from "./actions";
import { useAcao } from "@/components/form/use-acao";
import { FotoCampo } from "@/components/tecnico/foto-campo";
import { useGps } from "@/components/tecnico/use-gps";
import { usePreviaCep } from "@/components/tecnico/use-previa-cep";
import { TextoLocal } from "@/components/tecnico/texto-local";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const semAssinatura = () => () => {};
const meioNoNavegador = (): MeioRegistro | null => detectarMeio();
const meioNoServidor = (): MeioRegistro | null => null;

function Erro({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-destructive">{msg}</p> : null;
}

/** Check-in do técnico convidado: a própria chegada (local + foto, ou print na reunião online) para entrar na visita. */
export function EntrarForm({ visitaId, presencial, porCep = false }: { visitaId: string; presencial: boolean; porCep?: boolean }) {
  const [state, onSubmit, pending] = useAcao<EntrarState>(entrarNaVisita.bind(null, visitaId), {});
  const e = state.erros ?? {};
  const [temFoto, setTemFoto] = useState(false);
  const { estado: gps, capturar } = useGps();
  const previa = usePreviaCep(gps, porCep);
  const meio = useSyncExternalStore(semAssinatura, meioNoNavegador, meioNoServidor);

  // Presencial: pede a localização assim que a tela abre (igual ao check-in e ao check-out), sem o técnico ter de tocar em "Capturar".
  useEffect(() => {
    if (presencial) capturar();
  }, [presencial, capturar]);

  const pronto = presencial ? gps.fase === "ok" && temFoto : temFoto;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="meio" value={meio ?? ""} />
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}

      {presencial ? (
        <div className="space-y-3 rounded-lg border p-3">
          <input type="hidden" name="latitude" value={gps.fase === "ok" ? gps.latitude : ""} />
          <input type="hidden" name="longitude" value={gps.fase === "ok" ? gps.longitude : ""} />
          <input type="hidden" name="precisao" value={gps.fase === "ok" ? gps.precisao : ""} />
          <input type="hidden" name="capturadoEm" value={gps.fase === "ok" ? gps.capturadoEm : ""} />
          <div className="flex items-start gap-3">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", gps.fase === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
              {gps.fase === "buscando" ? <Loader2 className="size-4 animate-spin" /> : gps.fase === "ok" ? <Check className="size-4" /> : <LocateFixed className="size-4" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">Sua localização</div>
              {gps.fase === "parado" && <p className="text-xs text-muted-foreground">Registrada agora, ao entrar na visita.</p>}
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
          <div>
            <div className="mb-1.5 text-sm font-medium">Foto do ambiente</div>
            <FotoCampo name="fotoAmbiente" rotulo="Foto do ambiente" invalido={!!e.foto} onMudar={setTemFoto} />
            <Erro msg={e.foto} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-sm font-medium">Print da tela</div>
          <FotoCampo name="printTela" origem="galeria" rotulo="Print da tela" invalido={!!e.print} onMudar={setTemFoto} />
          <Erro msg={e.print} />
        </div>
      )}

      <div className="space-y-2 pb-2">
        <Button type="submit" disabled={!pronto || pending} className="h-12 w-full text-base">
          {pending ? <Loader2 className="animate-spin" /> : <Clock />}
          Entrar na visita
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {pronto ? "A sua entrada é registrada com a hora do servidor." : "Marque a localização e a foto para entrar."}
        </p>
      </div>
    </form>
  );
}
