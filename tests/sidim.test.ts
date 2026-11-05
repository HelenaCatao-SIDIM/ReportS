import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ASSINANTE, ASSINATURA, EMPRESA, LOGO, linhasDaEmpresa } from "@/lib/sidim";

test("os dados da SIDIM só mostram o que está preenchido", () => {
  assert.deepEqual(linhasDaEmpresa({ nome: "SIDIM Tecnologia" }), ["SIDIM Tecnologia"]);
  assert.deepEqual(
    linhasDaEmpresa({ nome: "SIDIM Tecnologia", razaoSocial: "SIDIM Sistemas Ltda", cnpj: "00.000.000/0000-00", endereco: "Rua A, 1 · Cidade/UF", telefone: "(00) 0000-0000", email: "a@b.com", site: "b.com" }),
    ["SIDIM Tecnologia", "SIDIM Sistemas Ltda", "CNPJ 00.000.000/0000-00", "Rua A, 1 · Cidade/UF", "(00) 0000-0000 · a@b.com", "b.com"],
  );
  assert.deepEqual(linhasDaEmpresa({ nome: "SIDIM", razaoSocial: "SIDIM", telefone: "  ", email: "a@b.com" }), ["SIDIM", "a@b.com"], "razão social igual ao nome não repete; vazio some");
  assert.ok(linhasDaEmpresa(EMPRESA).length >= 1);
});

test("quem assina os relatórios e as imagens existem, com o tamanho declarado", () => {
  assert.equal(ASSINANTE.nome, "Eduardo Catão Ribeiro");
  for (const img of [LOGO, ASSINATURA]) {
    const png = readFileSync(path.join(process.cwd(), "public", img.arquivo));
    assert.equal(png.subarray(1, 4).toString(), "PNG", img.arquivo);
    assert.equal(png.readUInt32BE(16), img.largura, `largura de ${img.arquivo}`);
    assert.equal(png.readUInt32BE(20), img.altura, `altura de ${img.arquivo}`);
  }
});
