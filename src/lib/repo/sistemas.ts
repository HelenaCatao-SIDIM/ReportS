import "server-only";
import { plataforma } from "@/lib/db";
import type { Sistema } from "@/lib/types";

/*
 * Repositório de sistemas — leitura da tabela `erp_systems` da plataforma.
 * O cadastro é mantido no Admin do SINC (RN-PL-04); o ReportS apenas lê.
 */

type Linha = Awaited<ReturnType<typeof plataforma.erp_systems.findMany>>[number];

const paraSistema = (s: Linha): Sistema => ({
  codigo: s.codigo,
  nome: s.nome,
  nomeClickUp: s.clickup_opcao_nome,
  nomeFortics: s.fortics_nome,
  ativo: s.ativo,
  ordem: s.posicao,
});

/** Sistemas na ordem do cadastro. Desativados só entram com `incluirInativos`. */
export async function listarSistemas(opcoes: { incluirInativos?: boolean } = {}): Promise<Sistema[]> {
  const linhas = await plataforma.erp_systems.findMany({
    where: opcoes.incluirInativos ? undefined : { ativo: true },
    orderBy: [{ posicao: "asc" }, { nome: "asc" }],
  });
  return linhas.map(paraSistema);
}

export async function buscarSistema(codigo: string): Promise<Sistema | undefined> {
  const s = await plataforma.erp_systems.findUnique({ where: { codigo } });
  return s ? paraSistema(s) : undefined;
}

/** Código → nome, para telas e PDF. Código desconhecido aparece como veio. */
export async function nomesDosSistemas(): Promise<(codigo: string) => string> {
  const nomes = new Map((await listarSistemas({ incluirInativos: true })).map((s) => [s.codigo, s.nome]));
  return (codigo) => nomes.get(codigo) ?? codigo;
}
