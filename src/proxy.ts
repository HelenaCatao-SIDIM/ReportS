import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";
import { registrarRequisicao } from "@/lib/repo/requisicoes";
import type { DesfechoRequisicao } from "@/lib/types";

// Verificação otimista: só confere se há sessão (o cookie guarda apenas o id do usuário). Quem decide a área e o que a
// pessoa pode fazer são as permissões, lidas no DAL (lib/dal.ts) a cada requisição; a página /inicio escolhe a área.
const AREAS = ["/admin", "/tecnico", "/inicio"];

/** Guarda só o caminho, sem a query string (pode ter token), e mascara o token do aprovador, que vai no próprio caminho. */
const caminhoSeguro = (pathname: string) => pathname.replace(/^\/aprovacao\/[^/]+/, "/aprovacao/[token]");

/** IP de quem fez, pelo cabeçalho do nginx (o primeiro da lista é o cliente). */
function ipDoPedido(req: NextRequest): string {
  const encadeado = req.headers.get("x-forwarded-for");
  if (encadeado) return encadeado.split(",")[0]?.trim() ?? "";
  return req.headers.get("x-real-ip") ?? "";
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const path = req.nextUrl.pathname;
  const sessao = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  const protegida = AREAS.some((a) => path === a || path.startsWith(a + "/"));
  let desfecho: DesfechoRequisicao = "ok";
  let resposta = NextResponse.next();
  if (protegida && !sessao) {
    desfecho = "login";
    resposta = NextResponse.redirect(new URL("/login", req.nextUrl));
  } else if ((path === "/login" || path === "/") && sessao) {
    desfecho = "inicio";
    resposta = NextResponse.redirect(new URL("/inicio", req.nextUrl));
  }

  // Log em segundo plano: não atrasa a resposta, e `registrarRequisicao` nunca derruba a requisição.
  event.waitUntil(
    registrarRequisicao({
      metodo: req.method,
      caminho: caminhoSeguro(path),
      usuarioId: typeof sessao?.userId === "string" ? sessao.userId : null,
      ip: ipDoPedido(req),
      desfecho,
    }),
  );

  return resposta;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg)$).*)"],
};
