"use client";

import { useEffect, useState } from "react";
import { previaCep, type PreviaCep } from "@/app/tecnico/geo-actions";
import type { EstadoGps } from "./use-gps";

export type EstadoPrevia = { fase: "parado" } | { fase: "buscando" } | { fase: "pronto"; previa: PreviaCep | null };

/** Quando o GPS responde, pergunta ao servidor o CEP daquele ponto (a tela nunca mostra a coordenada). */
export function usePreviaCep(gps: EstadoGps, ativo: boolean): EstadoPrevia {
  const [estado, setEstado] = useState<EstadoPrevia>({ fase: "parado" });
  const lat = gps.fase === "ok" ? gps.latitude : null;
  const lng = gps.fase === "ok" ? gps.longitude : null;

  useEffect(() => {
    if (!ativo || lat === null || lng === null) return;
    let vale = true;
    // Adiado para fora do efeito (padrão já usado no checkout-form para não disparar render em cascata).
    const inicio = setTimeout(() => vale && setEstado({ fase: "buscando" }), 0);
    previaCep(lat, lng)
      .then((previa) => vale && setEstado({ fase: "pronto", previa }))
      .catch(() => vale && setEstado({ fase: "pronto", previa: null }));
    return () => {
      vale = false;
      clearTimeout(inicio);
    };
  }, [ativo, lat, lng]);

  return ativo && lat !== null ? estado : { fase: "parado" };
}
