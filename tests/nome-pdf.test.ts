import assert from "node:assert/strict";
import { test } from "node:test";
import { cabecalhoDeDownload, nomeDoArquivoPdf, nomeDoRelatorio } from "@/lib/nome-pdf";

const base = { cliente: "Prefeitura de Vale Verde", sistema: "SCA", de: "2026-10-01", ate: "2026-10-31" };

test("o nome traz o tipo, o cliente, o sistema, o período e a versão", () => {
  assert.equal(nomeDoRelatorio({ ...base, tipo: "analitico", versao: 1 }), "Relatório Analítico - Prefeitura de Vale Verde - SCA - 01-10-2026 a 31-10-2026 - v1");
  assert.equal(nomeDoRelatorio({ ...base, tipo: "sintetico", versao: 2 }), "Relatório Sintético - Prefeitura de Vale Verde - SCA - 01-10-2026 a 31-10-2026 - v2");
  assert.equal(nomeDoRelatorio({ ...base }), "Relatório Sintético - Prefeitura de Vale Verde - SCA - 01-10-2026 a 31-10-2026", "sem tipo vale sintético; sem versão não leva v");
  assert.equal(nomeDoRelatorio({ ...base, tipo: "analitico", versao: 3, previa: true }), "PRÉVIA - Relatório Analítico - Prefeitura de Vale Verde - SCA - 01-10-2026 a 31-10-2026 - v3");
});

test("o nome do arquivo não tem caracteres proibidos e termina em .pdf", () => {
  const n = nomeDoArquivoPdf({ ...base, cliente: 'Câmara: São João / "Centro" <MG>?', versao: 1 });
  assert.match(n, /\.pdf$/);
  assert.doesNotMatch(n, /[\\/:*?"<>|]/);
  assert.match(n, /^Relatório Sintético - Câmara- São João - -Centro- -MG- - SCA/);
  const longo = nomeDoArquivoPdf({ ...base, cliente: "x".repeat(300), versao: 1 });
  assert.ok(longo.length <= 154);
});

test("download: nome em ASCII e o completo em UTF-8", () => {
  const h = cabecalhoDeDownload("Relatório Analítico - São João (SCA).pdf");
  assert.match(h, /^attachment; filename="Relatorio Analitico - Sao Joao \(SCA\)\.pdf"; filename\*=UTF-8''Relat%C3%B3rio%20Anal%C3%ADtico/);
  assert.equal(cabecalhoDeDownload("a.pdf", "inline"), `inline; filename="a.pdf"; filename*=UTF-8''a.pdf`);
  assert.ok(!cabecalhoDeDownload('x"y.pdf').includes('x"y'), "aspas não passam no nome simples");
});
