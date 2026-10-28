import "server-only";
import { localizacaoPorCep } from "@/lib/config";
import { enderecoPendente } from "@/lib/cep-visitas";
import type { LocalVisita } from "@/lib/types";

/** Diferença entre a hora do celular e a do servidor que merece registro (não bloqueia). */
const ALERTA_DIFERENCA_MS = 10 * 60 * 1000;

/**
 * Lê o local enviado pelo formulário de check-in/check-out (campos ocultos latitude, longitude,
 * precisao e capturadoEm) e marca a hora do servidor. Devolve null se a coordenada for inválida.
 */
export function lerLocal(fd: FormData, contexto: string): LocalVisita | null {
  const lat = Number(fd.get("latitude"));
  const lng = Number(fd.get("longitude"));
  const ok = fd.get("latitude") && fd.get("longitude") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!ok) return null;

  const precisao = Number(fd.get("precisao"));
  const capturado = new Date(String(fd.get("capturadoEm") ?? ""));
  const recebidoEm = new Date().toISOString();
  const capturadoEm = Number.isNaN(capturado.getTime()) ? null : capturado.toISOString();

  if (capturadoEm && Math.abs(Date.parse(recebidoEm) - Date.parse(capturadoEm)) > ALERTA_DIFERENCA_MS) {
    console.warn(`[local] ${contexto}: hora do celular (${capturadoEm}) difere mais de 10 min da do servidor (${recebidoEm}).`);
  }

  return {
    latitude: lat,
    longitude: lng,
    precisaoM: fd.get("precisao") && Number.isFinite(precisao) && precisao >= 0 ? Math.round(precisao) : null,
    capturadoEm,
    recebidoEm,
    endereco: localizacaoPorCep() ? enderecoPendente() : null,
  };
}
