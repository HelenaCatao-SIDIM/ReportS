#!/usr/bin/env node
/*
 * Diz se as migrações novas entre dois commits mexem em dados (apagam, alteram ou podem falhar com os dados que já
 * existem). O deploy automático usa isto para decidir: migração que só cria (tabela, coluna, índice) segue sozinha;
 * a que apaga ou altera dados espera a aprovação da Helena no GitHub.
 *
 * Uso:  node scripts/migracoes-perigosas.mjs <de> <para>      (dentro do repositório, de e para são commits)
 * Saída (uma informação por linha, fácil de ler por script):
 *   NOVAS=2
 *   PERIGOSA=true
 *   MIGRACAO 20261105190000_remove_chave_n8n PERIGOSA: apaga dados (DELETE)
 *   MIGRACAO 20261105150000_configuracoes ok
 *
 * Na dúvida, o resultado é "perigosa": é melhor pedir uma aprovação à toa do que aplicar sozinha uma migração que apaga dado.
 * Não depende de nenhum pacote: o servidor roda este arquivo direto do commit novo, antes de publicar.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PASTA = "prisma/reports/migrations/";

/** Quebra o texto nas vírgulas de fora de parênteses (numeric(10,2) não conta). */
function partirNasVirgulas(texto) {
  const partes = [];
  let nivel = 0;
  let atual = "";
  for (const c of texto) {
    if (c === "(") nivel++;
    if (c === ")") nivel--;
    if (c === "," && nivel === 0) {
      partes.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  partes.push(atual);
  return partes;
}

/** Motivos pelos quais um SQL de migração não deve rodar sem aprovação. Lista vazia = só cria coisas. */
export function analisarSql(sql) {
  const limpo = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((linha) => linha.replace(/--.*$/, ""))
    .join("\n")
    .toLowerCase();

  const motivos = new Set();
  const regras = [
    [/\bdrop\s+(table|column|schema|type|view|materialized\s+view|function|trigger)\b/, "apaga estrutura (DROP)"],
    [/\bdelete\s+from\b/, "apaga dados (DELETE)"],
    [/\btruncate\b/, "apaga dados (TRUNCATE)"],
    [/\bupdate\s+("?[\w.]+"?)\s+set\b/, "altera dados (UPDATE)"],
    [/\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/, "muda o tipo de uma coluna"],
    [/\balter\s+column\s+\S+\s+set\s+not\s+null\b/, "torna uma coluna obrigatória (falha se houver vazios)"],
    [/\brename\b/, "renomeia tabela ou coluna"],
    [/\brevoke\b/, "tira permissão"],
    [/\bdo\s+\$/, "bloco de código (DO)"],
    [/\bexecute\b/, "executa SQL montado em código"],
  ];
  for (const [regra, motivo] of regras) if (regra.test(limpo)) motivos.add(motivo);

  // Coluna nova obrigatória e sem valor padrão falha em tabela que já tem linhas.
  for (const comando of limpo.split(";")) {
    if (!/\balter\s+table\b/.test(comando)) continue;
    for (const parte of partirNasVirgulas(comando)) {
      if (/\badd\s+column\b/.test(parte) && /\bnot\s+null\b/.test(parte) && !/\bdefault\b/.test(parte)) {
        motivos.add("coluna nova obrigatória sem valor padrão (falha se a tabela tem linhas)");
      }
    }
  }
  return [...motivos];
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/** Compara as migrações entre dois commits. `de` pode ser omitido (tudo é novo). */
export function classificar(de, para, cwd = process.cwd()) {
  const alteracoes = git(["diff", "--name-status", "--no-renames", de, para, "--", PASTA], cwd)
    .split("\n")
    .filter(Boolean)
    .map((linha) => {
      const [status, caminho] = linha.split("\t");
      return { status, caminho };
    });

  const migracoes = [];
  const problemas = [];
  for (const { status, caminho } of alteracoes) {
    const nome = caminho.slice(PASTA.length).split("/")[0];
    if (status === "A" && caminho.endsWith("/migration.sql")) {
      const motivos = analisarSql(git(["show", `${para}:${caminho}`], cwd));
      migracoes.push({ nome, motivos });
    } else if (status !== "A") {
      // Migração que já foi aplicada não pode mudar nem sumir: o Prisma recusa e o histórico fica diferente do banco.
      problemas.push({ nome, motivos: [`migração que já existia foi ${status === "D" ? "removida" : "alterada"}`] });
    }
  }
  const todas = [...migracoes, ...problemas];
  return {
    novas: migracoes.length,
    perigosa: todas.some((m) => m.motivos.length > 0),
    migracoes: todas,
  };
}

export function formatar(resultado) {
  const linhas = [`NOVAS=${resultado.novas}`, `PERIGOSA=${resultado.perigosa}`];
  for (const m of resultado.migracoes) {
    linhas.push(`MIGRACAO ${m.nome} ${m.motivos.length ? `PERIGOSA: ${m.motivos.join("; ")}` : "ok"}`);
  }
  return linhas.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [de, para] = process.argv.slice(2);
  if (!de || !para) {
    console.error("Uso: node scripts/migracoes-perigosas.mjs <de> <para>");
    process.exit(2);
  }
  try {
    console.log(formatar(classificar(de, para)));
  } catch (erro) {
    console.error(`Não consegui comparar as migrações: ${erro instanceof Error ? erro.message.split("\n")[0] : erro}`);
    process.exit(2);
  }
}
