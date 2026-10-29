import "server-only";
import type { Sistema } from "@/lib/types";

/*
 * Repositório de sistemas — implementação MOCK em memória, só leitura.
 * O cadastro é mantido no Admin do SINC (RN-PL-04); o ReportS apenas lê.
 * Na fase de banco, só este arquivo muda (leitura da tabela da plataforma).
 */

function seed(): Sistema[] {
  const s = (ordem: number, codigo: string, nome: string, nomeFortics: string | null = null): Sistema => ({
    codigo,
    nome,
    nomeClickUp: null,
    nomeFortics,
    ativo: true,
    ordem,
  });
  return [s(1, "serp", "SERP"), s(2, "sca", "SCA"), s(3, "se", "SE"), s(4, "saude", "Saúde")];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __sistemas?: Sistema[] };
const sistemas = (g.__sistemas ??= seed());

const porOrdem = (a: Sistema, b: Sistema) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");

/** Sistemas na ordem do cadastro. Desativados só entram com `incluirInativos`. */
export async function listarSistemas(opcoes: { incluirInativos?: boolean } = {}): Promise<Sistema[]> {
  return sistemas.filter((s) => opcoes.incluirInativos || s.ativo).sort(porOrdem);
}

export async function buscarSistema(codigo: string): Promise<Sistema | undefined> {
  return sistemas.find((s) => s.codigo === codigo);
}

/** Código → nome, para telas e PDF. Código desconhecido aparece como veio. */
export async function nomesDosSistemas(): Promise<(codigo: string) => string> {
  const nomes = new Map(sistemas.map((s) => [s.codigo, s.nome]));
  return (codigo) => nomes.get(codigo) ?? codigo;
}
