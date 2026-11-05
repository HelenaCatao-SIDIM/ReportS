import assert from "node:assert/strict";
import { test } from "node:test";
import { conteudoParaEmitir } from "@/lib/regras-relatorio";

const suporte = (situacao: "ok" | "sem_vinculo" | "indisponivel", total: number) => ({ situacao, totalAbertosEFechados: total });

test("com visitas, sempre pode emitir (com ou sem chamados)", () => {
  assert.deepEqual(conteudoParaEmitir(1, null), { ok: true });
  assert.deepEqual(conteudoParaEmitir(3, suporte("ok", 0)), { ok: true });
  assert.deepEqual(conteudoParaEmitir(2, suporte("indisponivel", 0)), { ok: true });
});

test("sem visitas, só emite se o período tem chamados de suporte", () => {
  assert.deepEqual(conteudoParaEmitir(0, suporte("ok", 4)), { ok: true });
  for (const [s, trecho] of [
    [suporte("ok", 0), /nem chamados/],
    [suporte("indisponivel", 0), /não foi possível consultar/],
    [suporte("sem_vinculo", 0), /Nome no SINC/],
    [null, /CHAMADOS_SUPORTE/],
  ] as const) {
    const r = conteudoParaEmitir(0, s);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, trecho);
  }
});
