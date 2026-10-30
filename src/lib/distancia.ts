import type { Coordenadas, Visita } from "@/lib/types";

/** Raio de verificação de um estabelecimento novo, em metros. Cada estabelecimento ajusta o seu. */
export const RAIO_PADRAO_METROS = 50;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 178 → "178 m"; 1250 → "1,3 km". */
export function formatarDistancia(metros: number): string {
  return metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}

/** O check-in ficou dentro do raio do estabelecimento? Sem medição, não há como afirmar. */
export function dentroDoRaio(v: Pick<Visita, "distanciaCheckinM" | "raioCheckinM">): boolean {
  return v.distanciaCheckinM !== null && v.raioCheckinM !== null && v.distanciaCheckinM <= v.raioCheckinM;
}

/** O check-in ficou além do raio do estabelecimento? Sem medição, não há alerta. */
export function foraDoRaio(v: Pick<Visita, "distanciaCheckinM" | "raioCheckinM">): boolean {
  return v.distanciaCheckinM !== null && v.raioCheckinM !== null && v.distanciaCheckinM > v.raioCheckinM;
}
