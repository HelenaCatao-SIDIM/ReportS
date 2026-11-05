import assert from "node:assert/strict";
import { test } from "node:test";
import { urlN8nPermitida } from "@/lib/config-suporte";

test("o endereço do n8n: https sempre; http só fora de produção", () => {
  assert.equal(urlN8nPermitida("https://n8n.exemplo.com/webhook/x", true), true);
  assert.equal(urlN8nPermitida("http://n8n.exemplo.com/webhook/x", true), false);
  assert.equal(urlN8nPermitida("http://localhost:5678/webhook/x", false), true);
  assert.equal(urlN8nPermitida("ftp://x", false), false);
  assert.equal(urlN8nPermitida("n8n.exemplo.com", false), false);
});
