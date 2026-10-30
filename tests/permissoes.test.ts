import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOGO, PERMISSOES, acessoAdministracao, acessoTecnico, destinoAposLogin } from "@/lib/permissoes";

test("o login leva para a área que as permissões liberam", () => {
  assert.equal(destinoAposLogin([PERMISSOES.tecnico]), "/tecnico");
  assert.equal(destinoAposLogin([PERMISSOES.relatoriosGerenciar]), "/admin");
  assert.equal(destinoAposLogin([PERMISSOES.tecnico, PERMISSOES.temasGerenciar]), "/inicio");
});

test("sem permissão do ReportS não entra (RN-PL-61)", () => {
  assert.equal(destinoAposLogin([]), null);
  assert.equal(destinoAposLogin(["sinc.admin", "plataforma.usuarios.gerenciar"]), null);
  assert.equal(acessoAdministracao(["sinc.admin"]), false);
  assert.equal(acessoTecnico(["sinc.admin"]), false);
});

test("o catálogo tem códigos únicos, todos do ReportS", () => {
  const codigos = CATALOGO.map((p) => p.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
  assert.ok(codigos.every((c) => c.startsWith("reports.")));
  assert.deepEqual(new Set(codigos), new Set(Object.values(PERMISSOES)));
});
