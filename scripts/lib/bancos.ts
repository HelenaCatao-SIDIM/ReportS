/*
 * Conexões para os scripts de linha de comando (fora do Next): lê o .env como o Next e abre os dois bancos.
 */
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as ClientePlataforma } from "../../src/generated/plataforma/client";
import { PrismaClient as ClienteReports } from "../../src/generated/reports/client";

loadEnvConfig(process.cwd());

export const reports = new ClienteReports({ adapter: new PrismaPg({ connectionString: process.env.REPORTS_DATABASE_URL }) });
export const plataforma = new ClientePlataforma({ adapter: new PrismaPg({ connectionString: process.env.PLATAFORMA_DATABASE_URL }) });

/** Roda o script e fecha as conexões; erro sai com código 1 e a mensagem, sem pilha. */
export function rodar(principal: () => Promise<void>) {
  principal()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => Promise.all([reports.$disconnect(), plataforma.$disconnect()]));
}
