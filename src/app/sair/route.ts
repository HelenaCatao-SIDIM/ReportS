import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Pré-carregamento do Next.js (link visível na tela) ou do navegador: não é uma saída de verdade. */
function ePreCarga(req: NextRequest) {
  const h = req.headers;
  return (
    h.has("next-router-prefetch") ||
    h.has("next-router-segment-prefetch") ||
    /prefetch/i.test(h.get("purpose") ?? "") ||
    /prefetch/i.test(h.get("sec-purpose") ?? "")
  );
}

/**
 * Limpa a sessão e volta ao login (usado quando o cookie existe mas o usuário não é mais válido).
 * Um GET que apaga a sessão nunca pode ser pré-carregado: foi o que desconectava todo mundo logo depois do login
 * (o link "Sair" da tela /inicio era pré-carregado em produção). Para sair de propósito, use a ação `logout`.
 */
export function GET(req: NextRequest) {
  if (ePreCarga(req)) return new NextResponse(null, { status: 204 });
  const res = NextResponse.redirect(new URL("/login", req.nextUrl));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
