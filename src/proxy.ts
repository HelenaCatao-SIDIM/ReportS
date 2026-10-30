import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// Verificação otimista: só confere se há sessão (o cookie guarda apenas o id do usuário). Quem decide a área e o que a
// pessoa pode fazer são as permissões, lidas no DAL (lib/dal.ts) a cada requisição; a página /inicio escolhe a área.
const AREAS = ["/admin", "/tecnico", "/inicio"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const sessao = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  const protegida = AREAS.some((a) => path === a || path.startsWith(a + "/"));
  if (protegida && !sessao) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if ((path === "/login" || path === "/") && sessao) {
    return NextResponse.redirect(new URL("/inicio", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg)$).*)"],
};
