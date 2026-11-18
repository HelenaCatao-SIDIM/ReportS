import assert from "node:assert/strict";
import { test } from "node:test";
import { dimensoesPeloCabecalho } from "@/lib/imagem";

/** PNG mínimo: assinatura + IHDR com largura e altura (big-endian) em 16 e 20. */
function png(largura: number, altura: number): Blob {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // assinatura
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // tamanho do IHDR
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(b.buffer).setUint32(16, largura);
  new DataView(b.buffer).setUint32(20, altura);
  return new Blob([b]);
}

/** JPEG mínimo: SOI, um APP0 e um SOF0 com altura e largura. */
function jpeg(largura: number, altura: number): Blob {
  const b = new Uint8Array(40);
  const dv = new DataView(b.buffer);
  b.set([0xff, 0xd8], 0); // SOI
  b.set([0xff, 0xe0], 2); // APP0
  dv.setUint16(4, 16); // tamanho do APP0 (pula 14 bytes de dados)
  b.set([0xff, 0xc0], 20); // SOF0
  dv.setUint16(22, 17); // tamanho do SOF0
  b[24] = 8; // precisão
  dv.setUint16(25, altura);
  dv.setUint16(27, largura);
  return new Blob([b]);
}

test("lê as dimensões do cabeçalho PNG", async () => {
  assert.deepEqual(await dimensoesPeloCabecalho(png(4000, 3000)), { largura: 4000, altura: 3000 });
});

test("lê as dimensões do cabeçalho JPEG, pulando o APP0 até o SOF", async () => {
  assert.deepEqual(await dimensoesPeloCabecalho(jpeg(4032, 3024)), { largura: 4032, altura: 3024 });
});

test("formato desconhecido devolve null (decodifica em tamanho cheio como fallback)", async () => {
  assert.equal(await dimensoesPeloCabecalho(new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])])), null);
});
