/*
 * Confere se prisma/plataforma/schema.prisma está igual ao banco plataforma de agora (Fase 4 do plano).
 * A estrutura da plataforma é do SINC (D-03): quando o SINC muda uma tabela que o ReportS lê, este script falha
 * até alguém rodar `npm run db:plataforma:ler` e revisar o que mudou. Roda no deploy, antes do build.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const versionado = readFileSync("prisma/plataforma/schema.prisma", "utf8");
const atual = execFileSync("npx", ["prisma", "db", "pull", "--print", "--config", "prisma.plataforma.config.ts"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

// Compara só o que vira código: os comentários (inclusive as tabelas que o usuário do ReportS não pode ler, que
// aparecem comentadas) mudam de lugar entre o arquivo e a saída do --print.
const normalizar = (texto: string) =>
  texto
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !l.trim().startsWith("//"))
    .join("\n");

if (normalizar(versionado) !== normalizar(atual)) {
  console.error(
    "A estrutura do banco plataforma mudou e prisma/plataforma/schema.prisma está desatualizado.\n" +
      "Rode `npm run db:plataforma:ler`, revise a diferença (git diff) e ajuste os repositórios que leem a tabela que mudou.",
  );
  process.exit(1);
}
console.log("banco plataforma: igual ao prisma/plataforma/schema.prisma");
