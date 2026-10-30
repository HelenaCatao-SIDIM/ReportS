import { loadEnvConfig } from "@next/env";
import { defineConfig, env } from "prisma/config";

// Banco próprio do ReportS: estrutura com migrações do Prisma (prisma/reports/migrations).
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/reports/schema.prisma",
  migrations: { path: "prisma/reports/migrations" },
  datasource: { url: env("REPORTS_DATABASE_URL") },
});
