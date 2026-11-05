import assert from "node:assert/strict";
import { test } from "node:test";
import { urlN8nPermitida } from "@/lib/config-suporte";
import { cifrar, decifrar } from "@/lib/segredo";

process.env.SESSION_SECRET ??= "segredo-de-teste-com-bastante-texto-0123456789";

test("o segredo cifrado não mostra o texto e abre de volta", () => {
  const c = cifrar("chave-do-n8n-123");
  assert.ok(!c.includes("chave-do-n8n"));
  assert.match(c, /^v1\./);
  assert.equal(decifrar(c), "chave-do-n8n-123");
  assert.notEqual(cifrar("chave-do-n8n-123"), c, "cada cifragem usa um vetor novo");
});

test("segredo alterado, de outro formato ou de outro SESSION_SECRET não abre", () => {
  const c = cifrar("abc");
  const partes = c.split(".");
  partes[3] = Buffer.from("outro").toString("base64");
  assert.equal(decifrar(partes.join(".")), null, "dados trocados");
  assert.equal(decifrar("lixo"), null);
  assert.equal(decifrar(""), null);
  const antes = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "um-outro-segredo-bem-longo-9876543210";
  try {
    assert.equal(decifrar(c), null, "outro SESSION_SECRET");
  } finally {
    process.env.SESSION_SECRET = antes;
  }
});

test("o endereço do n8n: https sempre; http só fora de produção", () => {
  assert.equal(urlN8nPermitida("https://n8n.exemplo.com/webhook/x", true), true);
  assert.equal(urlN8nPermitida("http://n8n.exemplo.com/webhook/x", true), false);
  assert.equal(urlN8nPermitida("http://localhost:5678/webhook/x", false), true);
  assert.equal(urlN8nPermitida("ftp://x", false), false);
  assert.equal(urlN8nPermitida("n8n.exemplo.com", false), false);
});
