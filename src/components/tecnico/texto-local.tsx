"use client";

import { formatarCep, textoEndereco } from "@/lib/format";
import type { EstadoGps } from "./use-gps";
import type { EstadoPrevia } from "./use-previa-cep";

/**
 * Linha de status do local capturado, para o técnico. Com `porCep`, mostra o CEP no lugar da coordenada;
 * sem, mantém o comportamento antigo (coordenada).
 */
export function TextoLocal({ gps, porCep, previa }: { gps: Extract<EstadoGps, { fase: "ok" }>; porCep: boolean; previa: EstadoPrevia }) {
  const precisao = `±${Math.round(gps.precisao)} m`;

  if (!porCep) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · {precisao}
      </p>
    );
  }
  if (previa.fase !== "pronto") return <p className="text-xs text-muted-foreground">Localização capturada · {precisao} · Identificando o CEP…</p>;

  const p = previa.previa;
  if (p?.status === "ok" && p.cep) {
    const endereco = textoEndereco(p);
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">CEP {formatarCep(p.cep)}</span>
        {p.aproximado && <span> (aproximado)</span>} · {precisao}
        {endereco && <div className="truncate">{endereco}</div>}
      </div>
    );
  }
  const endereco = p ? textoEndereco(p) : "";
  return (
    <div className="text-xs text-muted-foreground">
      Localização capturada (CEP não identificado) · {precisao}
      {endereco && <div className="truncate">{endereco}</div>}
    </div>
  );
}
