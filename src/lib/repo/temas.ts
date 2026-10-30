import "server-only";
import { reports } from "@/lib/db";
import { normalizar } from "@/lib/format";
import type { Sistema, Tema } from "@/lib/types";
import { buscarSistema, listarSistemas, nomesDosSistemas } from "./sistemas";

/*
 * Temas — banco do ReportS. O sistema é o código do cadastro de sistemas da plataforma; o nome vem de lá na leitura.
 */

/** O que fica gravado: o sistema é só o código; o nome vem do cadastro de sistemas. */
type TemaRegistro = Omit<Tema, "sistemaNome">;

const SELECAO = { id: true, nome: true, sistema: true, modulo: true, ativo: true } as const;

const comNome = (t: TemaRegistro, nomeDe: (codigo: string) => string): Tema => ({ ...t, sistemaNome: nomeDe(t.sistema) });

/** Busca em nome, sistema e módulo (sem acento). Ordena pela ordem do cadastro de sistemas. */
export async function listarTemas(filtro: { busca?: string; sistema?: string } = {}): Promise<Tema[]> {
  const [nomeDe, todos, temas] = await Promise.all([
    nomesDosSistemas(),
    listarSistemas({ incluirInativos: true }),
    reports.tema.findMany({ where: filtro.sistema ? { sistema: filtro.sistema } : undefined, select: SELECAO }),
  ]);
  const posicao = new Map(todos.map((s) => [s.codigo, s.ordem]));
  const ordem = (codigo: string) => posicao.get(codigo) ?? Number.MAX_SAFE_INTEGER;
  const b = normalizar(filtro.busca ?? "");
  return temas
    .map((t) => comNome(t, nomeDe))
    .filter((t) => !b || [t.nome, t.sistemaNome, t.sistema, t.modulo].some((c) => normalizar(c).includes(b)))
    .sort(
      (a, c) =>
        ordem(a.sistema) - ordem(c.sistema) ||
        a.modulo.localeCompare(c.modulo, "pt-BR") ||
        a.nome.localeCompare(c.nome, "pt-BR"),
    );
}

/** Temas pelos ids, com o nome do sistema (para as visitas). */
export async function buscarTemasPorIds(ids: string[]): Promise<Tema[]> {
  if (!ids.length) return [];
  const [nomeDe, temas] = await Promise.all([nomesDosSistemas(), reports.tema.findMany({ where: { id: { in: ids } }, select: SELECAO })]);
  return temas.map((t) => comNome(t, nomeDe));
}

async function modulosUsados(): Promise<string[]> {
  const linhas = await reports.tema.findMany({ distinct: ["modulo"], select: { modulo: true } });
  return linhas.map((t) => t.modulo).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Opções dos campos: sistemas ativos e módulos já usados. */
export async function sugestoes(): Promise<{ sistemas: Sistema[]; modulos: string[] }> {
  const [sistemas, modulos] = await Promise.all([listarSistemas(), modulosUsados()]);
  return { sistemas, modulos };
}

/** Sistema aceito para um tema: ativo, ou o mesmo que o tema já tinha (RN-PL-02). */
export async function sistemaValido(codigo: string, temaId?: string): Promise<boolean> {
  const s = await buscarSistema(codigo);
  if (!s) return false;
  if (s.ativo) return true;
  const tema = temaId ? await reports.tema.findUnique({ where: { id: temaId }, select: { sistema: true } }) : null;
  return tema?.sistema === codigo;
}

export type DadosTema = Pick<TemaRegistro, "nome" | "sistema" | "modulo">;

export async function temaDuplicado(d: DadosTema, excetoId?: string) {
  const chave = (t: DadosTema) => [t.nome, t.sistema, t.modulo].map(normalizar).join("|");
  const doSistema = await reports.tema.findMany({ where: { sistema: d.sistema }, select: SELECAO });
  return doSistema.some((t) => t.id !== excetoId && chave(t) === chave(d));
}

/** Reaproveita a grafia já cadastrada quando o módulo só difere em acento/caixa ("recepcao" → "Recepção"). */
export async function grafiaCanonica(d: DadosTema, excetoId?: string): Promise<DadosTema> {
  const outros = await reports.tema.findMany({ where: excetoId ? { NOT: { id: excetoId } } : undefined, select: { modulo: true } });
  return { ...d, modulo: outros.find((t) => normalizar(t.modulo) === normalizar(d.modulo))?.modulo ?? d.modulo };
}

export async function criarTema(d: DadosTema): Promise<Tema> {
  const t = await reports.tema.create({ data: { ...d, id: crypto.randomUUID() }, select: SELECAO });
  return comNome(t, await nomesDosSistemas());
}

export async function atualizarTema(id: string, d: DadosTema): Promise<void> {
  await reports.tema.updateMany({ where: { id }, data: d });
}

export async function definirTemaAtivo(id: string, ativo: boolean): Promise<void> {
  await reports.tema.updateMany({ where: { id }, data: { ativo } });
}
