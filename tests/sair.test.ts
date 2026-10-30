/*
 * A saída do sistema é uma ação (formulário), nunca um link. O Next.js pré-carrega os links visíveis em produção, e a
 * rota GET /sair apaga a sessão: em 30/10/2026 isso desconectava todo mundo logo depois do login (a tela /inicio tinha
 * um <Link href="/sair">). Em desenvolvimento não há pré-carregamento, então só um teste pega isso.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../src/app/sair/route";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (nome === "generated") return [];
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe("sair", () => {
  it("nenhuma tela tem link para /sair (seria pré-carregado e apagaria a sessão)", () => {
    const achados = arquivos("src").filter((f) => /href=\{?["']\/sair["']/.test(readFileSync(f, "utf8")));
    assert.deepEqual(achados, []);
  });

  it("a rota /sair ignora o pré-carregamento: não apaga o cookie nem redireciona", async () => {
    const pre: Record<string, string>[] = [{ "next-router-prefetch": "1" }, { "next-router-segment-prefetch": "/_tree" }, { purpose: "prefetch" }, { "sec-purpose": "prefetch" }];
    for (const cabecalho of pre) {
      const res = GET(new NextRequest("http://localhost/sair", { headers: cabecalho }));
      assert.equal(res.status, 204, JSON.stringify(cabecalho));
      assert.equal(res.headers.get("set-cookie"), null, JSON.stringify(cabecalho));
    }
  });

  it("a rota /sair, numa navegação de verdade, apaga a sessão e volta ao login", () => {
    const res = GET(new NextRequest("http://localhost/sair", { headers: { cookie: "sessao=x" } }));
    assert.equal(res.status, 307);
    assert.equal(new URL(res.headers.get("location")!).pathname, "/login");
    assert.match(res.headers.get("set-cookie") ?? "", /sessao=;/);
  });
});
