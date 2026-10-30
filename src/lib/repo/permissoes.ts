import "server-only";
import { CATALOGO, PERMISSOES } from "@/lib/permissoes";
import type { Papel } from "@/lib/types";

/*
 * Papéis e permissões — implementação MOCK em memória, só leitura.
 * Na plataforma, os papéis e a atribuição aos usuários são feitos no Admin do SINC (RN-PL-65);
 * o ReportS só lê e registra o catálogo das próprias permissões (src/lib/permissoes.ts).
 * Na fase de banco, só este arquivo (e usuarios.ts) muda.
 */

const todasDoReports = CATALOGO.map((p) => p.codigo as string);

function seed(): Papel[] {
  return [
    { id: "coordenacao", nome: "Coordenação ReportS", descricao: "Todas as permissões do ReportS.", permissoes: todasDoReports },
    { id: "tecnico-de-campo", nome: "Técnico de campo", descricao: "App do Técnico.", permissoes: [PERMISSOES.tecnico] },
    { id: "faturamento", nome: "Faturamento", descricao: "Acompanha e emite relatórios.", permissoes: [PERMISSOES.relatoriosGerenciar] },
  ];
}

const g = globalThis as unknown as { __papeis?: Papel[] };
const papeis = (g.__papeis ??= seed());

export async function listarPapeis(): Promise<Papel[]> {
  return papeis;
}

/** Soma das permissões dos papéis, sem repetição. Lida a cada requisição (sem cache), para valer na próxima tela (RN-PL-64). */
export async function permissoesDosPapeis(papelIds: string[]): Promise<{ permissoes: string[]; papeis: string[] }> {
  const dele = papeis.filter((p) => papelIds.includes(p.id));
  return { permissoes: [...new Set(dele.flatMap((p) => p.permissoes))], papeis: dele.map((p) => p.nome) };
}
