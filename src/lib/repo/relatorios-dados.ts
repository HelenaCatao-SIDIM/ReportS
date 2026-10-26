import "server-only";
import type { Relatorio, TokenAprovacao } from "@/lib/types";

/*
 * Dados dos relatórios — MOCK em memória, em módulo próprio para que o repositório de visitas
 * consulte o status (trava) sem dependência circular com o repositório de relatórios.
 */

function seed(): Relatorio[] {
  return [
    {
      id: "r-2026-09-c1",
      clienteId: "c1",
      de: "2026-09-01",
      ate: "2026-09-30",
      status: "aprovado",
      visitaIds: ["v8"],
      versoes: [
        {
          numero: 1,
          emitidoEm: "2026-10-02T13:00:00.000Z",
          visitaIds: ["v8"],
          pdfUrl: null,
          pdfTamanho: 0,
          enviadoPara: [{ nome: "Marta Ribeiro", email: "marta.ribeiro@valeverde.example" }, { nome: "José Antunes", email: "jose.antunes@valeverde.example" }],
          conteudo: null,
          decisao: {
            tipo: "aprovado",
            aprovadorNome: "Marta Ribeiro",
            aprovadorEmail: "marta.ribeiro@valeverde.example",
            motivo: null,
            em: "2026-10-03T14:20:00.000Z",
          },
        },
      ],
      criadoEm: "2026-10-01T12:00:00.000Z",
      atualizadoEm: "2026-10-03T14:20:00.000Z",
    },
  ];
}

const g = globalThis as unknown as { __relatorios?: Relatorio[] };
export const relatorios = (g.__relatorios ??= seed());

/** Visitas de relatório aprovado ficam travadas. */
export const relatorioAprovado = (id: string | null) => !!id && relatorios.some((r) => r.id === id && r.status === "aprovado");

const gt = globalThis as unknown as { __tokens?: TokenAprovacao[] };
export const tokens = (gt.__tokens ??= []);
