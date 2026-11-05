import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { analisarSql, classificar, formatar } from "../scripts/migracoes-perigosas.mjs";

test("migração que só cria (tabela, coluna, índice, chave estrangeira) segue sozinha", () => {
  assert.deepEqual(
    analisarSql(`
      -- CreateTable
      CREATE TABLE "configuracoes" ("chave" TEXT NOT NULL, "valor" TEXT, "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("chave"));
      -- AlterTable
      ALTER TABLE "visitas" ADD COLUMN "observacao" TEXT, ADD COLUMN "nota" DECIMAL(10,2) NOT NULL DEFAULT 0;
      CREATE UNIQUE INDEX "visitas_codigo_key" ON "visitas"("codigo");
      ALTER TABLE "presencas" ADD CONSTRAINT "presencas_visita_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      ALTER TABLE "presencas" ADD CONSTRAINT "outra_fkey" FOREIGN KEY ("x") REFERENCES "y"("id") ON DELETE SET NULL ON UPDATE SET NULL;
      INSERT INTO "temas" ("id","nome") VALUES (1,'Geral');
    `),
    [],
  );
});

test("o que o comentário diz não conta: só o SQL de verdade", () => {
  assert.deepEqual(analisarSql("-- DELETE FROM tudo;\n/* DROP TABLE x; */\nCREATE INDEX i ON t(c);"), []);
});

test("migração que apaga ou altera dados espera aprovação", () => {
  assert.deepEqual(analisarSql(`DELETE FROM "configuracoes" WHERE "chave" = 'n8n.resumo_chamados.chave';`), ["apaga dados (DELETE)"]);
  assert.deepEqual(analisarSql(`DROP TABLE "antiga";`), ["apaga estrutura (DROP)"]);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" DROP COLUMN "observacao";`), ["apaga estrutura (DROP)"]);
  assert.deepEqual(analisarSql(`TRUNCATE TABLE "cbo";`), ["apaga dados (TRUNCATE)"]);
  assert.deepEqual(analisarSql(`UPDATE "visitas" SET "situacao" = 'encerrada' WHERE "fim" IS NOT NULL;`), ["altera dados (UPDATE)"]);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ALTER COLUMN "nota" TYPE INTEGER;`), ["muda o tipo de uma coluna"]);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ALTER COLUMN "nota" SET DATA TYPE INTEGER;`), ["muda o tipo de uma coluna"]);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ALTER COLUMN "nota" SET NOT NULL;`), ["torna uma coluna obrigatória (falha se houver vazios)"]);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" RENAME COLUMN "a" TO "b";`), ["renomeia tabela ou coluna"]);
  assert.deepEqual(analisarSql(`DO $$ BEGIN PERFORM 1; END $$;`), ["bloco de código (DO)"]);
});

test("coluna nova obrigatória sem valor padrão falha em tabela com linhas; com valor padrão, não", () => {
  const motivo = ["coluna nova obrigatória sem valor padrão (falha se a tabela tem linhas)"];
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ADD COLUMN "nota" INTEGER NOT NULL;`), motivo);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ADD COLUMN "a" TEXT, ADD COLUMN "nota" NUMERIC(10,2) NOT NULL;`), motivo, "a vírgula de numeric(10,2) não esconde o NOT NULL");
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ADD COLUMN "nota" INTEGER NOT NULL DEFAULT 0;`), []);
  assert.deepEqual(analisarSql(`ALTER TABLE "visitas" ADD COLUMN "nota" INTEGER;`), []);
});

test("todas as migrações que já estão no repositório: só a que apaga a chave antiga do n8n é perigosa", () => {
  const pasta = join(process.cwd(), "prisma/reports/migrations");
  const perigosas = readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => analisarSql(readFileSync(join(pasta, d.name, "migration.sql"), "utf8")).length > 0)
    .map((d) => d.name);
  assert.deepEqual(perigosas, ["20261105190000_remove_chave_n8n"]);
});

test("compara dois commits: migração nova segura, perigosa, e migração antiga mexida", () => {
  const dir = mkdtempSync(join(tmpdir(), "migracoes-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const migracao = (nome: string, sql: string) => {
    mkdirSync(join(dir, "prisma/reports/migrations", nome), { recursive: true });
    writeFileSync(join(dir, "prisma/reports/migrations", nome, "migration.sql"), sql);
  };
  try {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "teste@teste.local");
    git("config", "user.name", "Teste");
    migracao("20260101000000_inicial", 'CREATE TABLE "a" ("id" INTEGER);');
    git("add", "-A");
    git("commit", "-q", "-m", "inicial");
    const base = git("rev-parse", "HEAD");

    migracao("20260102000000_coluna", 'ALTER TABLE "a" ADD COLUMN "b" TEXT;');
    git("add", "-A");
    git("commit", "-q", "-m", "coluna");
    const segura = git("rev-parse", "HEAD");

    migracao("20260103000000_limpeza", 'DELETE FROM "a";');
    git("add", "-A");
    git("commit", "-q", "-m", "limpeza");
    const perigosa = git("rev-parse", "HEAD");

    writeFileSync(join(dir, "prisma/reports/migrations/20260101000000_inicial/migration.sql"), 'CREATE TABLE "a" ("id" BIGINT);');
    git("add", "-A");
    git("commit", "-q", "-m", "mexeu na antiga");
    const mexida = git("rev-parse", "HEAD");

    assert.deepEqual(classificar(base, base, dir), { novas: 0, perigosa: false, migracoes: [] }, "nada novo: nada a fazer");
    assert.deepEqual(classificar(base, segura, dir), { novas: 1, perigosa: false, migracoes: [{ nome: "20260102000000_coluna", motivos: [] }] });
    const r = classificar(base, perigosa, dir);
    assert.equal(r.novas, 2);
    assert.equal(r.perigosa, true, "uma perigosa no meio torna o conjunto perigoso");
    assert.equal(formatar(r), "NOVAS=2\nPERIGOSA=true\nMIGRACAO 20260102000000_coluna ok\nMIGRACAO 20260103000000_limpeza PERIGOSA: apaga dados (DELETE)");
    const m = classificar(perigosa, mexida, dir);
    assert.equal(m.perigosa, true);
    assert.deepEqual(m.migracoes, [{ nome: "20260101000000_inicial", motivos: ["migração que já existia foi alterada"] }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
