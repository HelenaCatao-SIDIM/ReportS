/*
 * Importa a tabela CBO oficial (Ministério do Trabalho) para o banco do ReportS.
 *
 * Uso: npm run cbo:importar -- "caminho/CBO2002 - Ocupacao.csv"
 *
 * O arquivo é o "CBO2002 - Ocupacao.csv" do pacote de downloads do site da CBO (mtecbo.gov.br): duas colunas,
 * CODIGO e TITULO, separadas por ponto e vírgula, em ISO-8859-1 (aceita UTF-8 também). Inclui as ocupações novas e
 * atualiza os títulos que mudaram; nada é apagado, porque presenças antigas guardam o código. Rodar de novo não muda nada.
 */
import { readFileSync } from "node:fs";
import { reports, rodar } from "./lib/bancos";

function lerTexto(caminho: string) {
  const bytes = readFileSync(caminho);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Sem caractere inválido, é UTF-8; senão, é o ISO-8859-1 do arquivo oficial.
  return utf8.includes("�") ? new TextDecoder("latin1").decode(bytes) : utf8;
}

rodar(async () => {
  const caminho = process.argv[2];
  if (!caminho) throw new Error('Informe o arquivo: npm run cbo:importar -- "CBO2002 - Ocupacao.csv"');

  const linhas = lerTexto(caminho).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cabecalho = linhas.shift()?.toUpperCase().split(";").map((c) => c.trim().replace(/"/g, ""));
  if (cabecalho?.[0] !== "CODIGO" || cabecalho?.[1] !== "TITULO") throw new Error("Cabeçalho inesperado: o arquivo deve começar com CODIGO;TITULO");

  const ocupacoes = new Map<string, string>();
  const recusadas: string[] = [];
  for (const linha of linhas) {
    const [codigo, ...resto] = linha.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
    const titulo = resto.join(";").replace(/\s+/g, " ").trim();
    const digitos = codigo.replace(/\D/g, "");
    if (!/^\d{6}$/.test(digitos) || !titulo) recusadas.push(linha);
    else ocupacoes.set(digitos, titulo);
  }
  if (ocupacoes.size < 1000) throw new Error(`Só ${ocupacoes.size} ocupações válidas no arquivo; a tabela oficial tem cerca de 2.600. Nada foi gravado.`);

  const atuais = new Map((await reports.cbo.findMany()).map((c) => [c.codigo, c.titulo]));
  const novas = [...ocupacoes].filter(([codigo]) => !atuais.has(codigo));
  const mudaram = [...ocupacoes].filter(([codigo, titulo]) => atuais.has(codigo) && atuais.get(codigo) !== titulo);

  await reports.$transaction(async (tx) => {
    await tx.cbo.createMany({ data: novas.map(([codigo, titulo]) => ({ codigo, titulo })) });
    for (const [codigo, titulo] of mudaram) await tx.cbo.update({ where: { codigo }, data: { titulo } });
  });

  console.log(`CBO: ${ocupacoes.size} ocupações no arquivo; ${novas.length} incluídas, ${mudaram.length} com título atualizado.`);
  if (recusadas.length) console.log(`${recusadas.length} linha(s) ignoradas por código ou título inválido, por exemplo: ${recusadas.slice(0, 3).join(" | ")}`);
});
