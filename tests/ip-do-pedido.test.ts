import assert from "node:assert/strict";
import { test } from "node:test";
import { ipDoPedido } from "../src/lib/ip-do-pedido";

test("o IP do log vem do X-Real-IP que o nginx grava", () => {
  assert.equal(ipDoPedido(new Headers({ "x-real-ip": "203.0.113.7" })), "203.0.113.7");
  assert.equal(ipDoPedido(new Headers({ "x-real-ip": "  203.0.113.7 " })), "203.0.113.7");
});

test("X-Forwarded-For preenchido pelo navegador não vira o IP do log", () => {
  // O nginx acrescenta o endereço real ao FIM; o primeiro item é o que o próprio cliente escreveu.
  const forjado = new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7", "x-real-ip": "203.0.113.7" });
  assert.equal(ipDoPedido(forjado), "203.0.113.7");
  assert.equal(ipDoPedido(new Headers({ "x-forwarded-for": "1.2.3.4" })), "", "sem X-Real-IP não aproveita o X-Forwarded-For");
});

test("sem cabeçalho nenhum, o IP fica vazio", () => {
  assert.equal(ipDoPedido(new Headers()), "");
});
