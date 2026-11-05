import assert from "node:assert/strict";
import { test } from "node:test";
import { nomesDoCliente, urlN8nPermitida } from "@/lib/config-suporte";

test("o endereço do n8n: https sempre; http só fora de produção", () => {
  assert.equal(urlN8nPermitida("https://n8n.exemplo.com/webhook/x", true), true);
  assert.equal(urlN8nPermitida("http://n8n.exemplo.com/webhook/x", true), false);
  assert.equal(urlN8nPermitida("http://localhost:5678/webhook/x", false), true);
  assert.equal(urlN8nPermitida("ftp://x", false), false);
  assert.equal(urlN8nPermitida("n8n.exemplo.com", false), false);
});

test("os chamados são buscados pelo nome do cliente no SINC e pelos outros nomes cadastrados, sem repetir", () => {
  assert.deepEqual(nomesDoCliente({ nome: "Prefeitura de Vale Verde" }), ["Prefeitura de Vale Verde"]);
  assert.deepEqual(nomesDoCliente({ nome: "Prefeitura de Vale Verde", nomesFortics: [] }), ["Prefeitura de Vale Verde"]);
  assert.deepEqual(nomesDoCliente({ nome: "Prefeitura de Vale Verde", nomesFortics: ["Prefeitura de Vale Verde / Vale Verde", "  prefeitura  de vale verde "] }), ["Prefeitura de Vale Verde", "Prefeitura de Vale Verde / Vale Verde"], "repetido (sem acento, caixa e espaços extras) some");
  assert.deepEqual(nomesDoCliente({ nome: "Mariana", nomesFortics: ["MARIANA", "Mariana - MG"] }), ["Mariana", "Mariana - MG"]);
  assert.deepEqual(nomesDoCliente({ nome: "   ", nomesFortics: [""] }), []);
  const muitos = Array.from({ length: 15 }, (_, i) => `Nome ${i}`);
  assert.equal(nomesDoCliente({ nome: "Cliente", nomesFortics: muitos }).length, 10, "o fluxo aceita até 10 nomes");
  assert.deepEqual(nomesDoCliente({ nome: "Cliente", nomesFortics: ["x".repeat(121)] }), ["Cliente"], "nome acima de 120 caracteres derrubaria a consulta: é ignorado");
});
