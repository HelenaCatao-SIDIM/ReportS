import assert from "node:assert/strict";
import { test } from "node:test";
import { conteudoParaEmitir } from "@/lib/regras-relatorio";

const suporte = (situacao: "ok" | "sem_vinculo" | "indisponivel" | "nao_configurado", total: number) => ({ situacao, totalAbertosEFechados: total });

test("com visitas, sempre pode emitir (com ou sem chamados)", () => {
  assert.deepEqual(conteudoParaEmitir(1, suporte("ok", 0)), { ok: true });
  assert.deepEqual(conteudoParaEmitir(3, suporte("indisponivel", 0)), { ok: true });
  assert.deepEqual(conteudoParaEmitir(2, suporte("nao_configurado", 0)), { ok: true });
  assert.deepEqual(conteudoParaEmitir(1, null), { ok: true });
});

test("sem visitas, emite com chamados e também sem chamados no período (consulta feita)", () => {
  assert.deepEqual(conteudoParaEmitir(0, suporte("ok", 4)), { ok: true });
  assert.deepEqual(conteudoParaEmitir(0, suporte("ok", 0)), { ok: true });
});

test("sem visitas, só não emite se os chamados não puderam ser consultados", () => {
  for (const [s, trecho] of [
    [suporte("indisponivel", 0), /não foi possível consultar/],
    [suporte("sem_vinculo", 0), /sem nome no cadastro/],
    [suporte("nao_configurado", 0), /Configurações/],
    [null, /não foi possível consultar/],
  ] as const) {
    const r = conteudoParaEmitir(0, s);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, trecho);
  }
});
