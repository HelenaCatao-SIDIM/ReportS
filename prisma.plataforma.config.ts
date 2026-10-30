import { loadEnvConfig } from "@next/env";
import { defineConfig, env } from "prisma/config";

// Banco plataforma, comum ao SINC: só o SINC muda a estrutura (D-03). Aqui o schema vem só da introspecção
// (`npm run db:plataforma:ler`); nunca rodar migrate com esta configuração.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/plataforma/schema.prisma",
  datasource: { url: env("PLATAFORMA_DATABASE_URL") },
});
