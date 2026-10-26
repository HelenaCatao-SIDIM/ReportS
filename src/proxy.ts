import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Verificação otimista (só o cookie). A checagem completa fica no DAL (lib/dal.ts).
const AREAS = { "/admin": "gestor", "/tecnico": "tecnico" } as const;
const HOME = { gestor: "/admin", tecnico: "/tecnico" } as const;

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const sessao = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  const area = (Object.keys(AREAS) as (keyof typeof AREAS)[]).find(
    (a) => path === a || path.startsWith(a + "/"),
  );

  if (area && !sessao) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (area && sessao && AREAS[area] !== sessao.perfil) {
    return NextResponse.redirect(new URL(HOME[sessao.perfil], req.nextUrl));
  }
  if ((path === "/login" || path === "/") && sessao) {
    return NextResponse.redirect(new URL(HOME[sessao.perfil], req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg)$).*)"],
};
