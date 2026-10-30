import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as ClientePlataforma } from "@/generated/plataforma/client";
import { PrismaClient as ClienteReports } from "@/generated/reports/client";

/*
 * As duas conexões do ReportS (Fase 4 do plano da plataforma):
 * - `reports`: o banco próprio (contratos, aprovadores, estabelecimentos, temas, visitas, relatórios, arquivos, e-mails);
 * - `plataforma`: o banco comum ao SINC (sistemas, usuários, papéis e permissões, clientes, sistemas do cliente,
 *   participantes), com o usuário de banco do ReportS, que só lê ou grava o que lhe cabe (ADR-035 do SINC).
 * Não há transação nem consulta entre os dois: quem grava nos dois escolhe uma ordem que deixe só estados corrigíveis.
 */

const g = globalThis as unknown as { __reports?: ClienteReports; __plataforma?: ClientePlataforma };

export const reports = (g.__reports ??= new ClienteReports({
  adapter: new PrismaPg({ connectionString: process.env.REPORTS_DATABASE_URL }),
}));

export const plataforma = (g.__plataforma ??= new ClientePlataforma({
  adapter: new PrismaPg({ connectionString: process.env.PLATAFORMA_DATABASE_URL }),
}));

/** Id numérico da plataforma (bigint) para texto, como o resto do ReportS usa. */
export const idTexto = (id: bigint) => id.toString();

/** Texto para o id da plataforma; null se não for um número (link adulterado, id do protótipo). */
export function idPlataforma(id: string | null | undefined): bigint | null {
  return id && /^\d{1,18}$/.test(id) ? BigInt(id) : null;
}
