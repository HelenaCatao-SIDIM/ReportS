import type { MeioRegistro } from "@/lib/types";

export const ROTULO_MEIO: Record<MeioRegistro, string> = {
  celular: "Celular",
  computador: "Computador",
};

export const ehMeio = (v: string): v is MeioRegistro => v === "celular" || v === "computador";

/** Descobre, no navegador, se o técnico está no celular (ou tablet) ou no computador. */
export function detectarMeio(): MeioRegistro {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return "celular";
  // iPad com Safari em modo "site para computador" se apresenta como Mac, mas tem tela de toque.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "celular";
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return uaData?.mobile ? "celular" : "computador";
}
