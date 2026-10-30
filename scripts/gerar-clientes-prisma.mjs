/*
 * Gera os clientes do Prisma dos dois bancos (roda no postinstall). O `prisma generate` não abre conexão, mas as
 * configurações exigem as URLs dos bancos (env() do Prisma 7). Num clone novo (npm install antes do .env.local) ou
 * numa CI sem bancos, usa endereços fictícios só aqui; migrate, db pull e o app continuam exigindo os de verdade.
 * Em Node, e não com VAR=valor no package.json, para funcionar também no Windows.
 */
import { execFileSync } from "node:child_process";

const env = { ...process.env };
for (const nome of ["REPORTS_DATABASE_URL", "PLATAFORMA_DATABASE_URL"]) {
  env[nome] ??= "postgresql://gerar:gerar@localhost:5432/gerar";
}
for (const config of ["prisma.reports.config.ts", "prisma.plataforma.config.ts"]) {
  execFileSync("npx", ["prisma", "generate", "--config", config], { stdio: "inherit", env, shell: process.platform === "win32" });
}
