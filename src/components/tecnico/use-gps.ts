"use client";

import { useCallback, useState } from "react";

export type EstadoGps =
  | { fase: "parado" }
  | { fase: "buscando" }
  | { fase: "ok"; latitude: number; longitude: number; precisao: number }
  | { fase: "erro"; mensagem: string };

const MENSAGENS: Record<number, string> = {
  1: "Permissão de localização negada. Libere a localização para este site nas configurações do navegador e tente de novo.",
  2: "Não foi possível obter a localização. Verifique se a localização do aparelho está ligada.",
  3: "A localização demorou demais. Vá para um lugar com melhor sinal e tente de novo.",
};

/** Captura a localização uma única vez (só no check-in e no check-out; sem rastreamento contínuo). */
export function useGps() {
  const [estado, setEstado] = useState<EstadoGps>({ fase: "parado" });

  const capturar = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setEstado({ fase: "erro", mensagem: "Este navegador não oferece localização." });
      return;
    }
    setEstado({ fase: "buscando" });
    navigator.geolocation.getCurrentPosition(
      (p) => setEstado({ fase: "ok", latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: p.coords.accuracy }),
      (e) => setEstado({ fase: "erro", mensagem: MENSAGENS[e.code] ?? "Erro ao obter a localização." }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, []);

  return { estado, capturar };
}
