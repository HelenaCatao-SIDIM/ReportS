import "server-only";
import { normalizar } from "@/lib/format";
import type { Sistema, Tema } from "@/lib/types";
import { buscarSistema, listarSistemas, nomesDosSistemas } from "./sistemas";

/*
 * Repositório de temas — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

/** O que fica gravado: o sistema é só o código; o nome vem do cadastro de sistemas. */
type TemaRegistro = Omit<Tema, "sistemaNome">;

function seed(): TemaRegistro[] {
  const t = (id: string, nome: string, sistema: string, modulo: string, ativo = true): TemaRegistro => ({ id, nome, sistema, modulo, ativo });
  return [
    t("t1", "Cadastro de contribuintes", "serp", "Cadastros"),
    t("t2", "Emissão de guias de IPTU", "serp", "Arrecadação"),
    t("t3", "Baixa de pagamentos", "serp", "Arrecadação"),
    t("t4", "Folha de pagamento mensal", "sca", "Folha"),
    t("t5", "Cálculo de férias", "sca", "Folha"),
    t("t6", "Ponto eletrônico", "sca", "Frequência"),
    t("t7", "Agendamento de consultas", "saude", "Recepção"),
    t("t8", "Dispensação de medicamentos", "saude", "Farmácia"),
    t("t9", "Relatórios gerenciais (versão antiga)", "saude", "Relatórios", false),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __temas?: TemaRegistro[] };
const temas = (g.__temas ??= seed());

const comNome = (t: TemaRegistro, nomeDe: (codigo: string) => string): Tema => ({ ...t, sistemaNome: nomeDe(t.sistema) });

/** Busca em nome, sistema e módulo (sem acento). Ordena pela ordem do cadastro de sistemas. */
export async function listarTemas(filtro: { busca?: string; sistema?: string } = {}): Promise<Tema[]> {
  const [nomeDe, todos] = await Promise.all([nomesDosSistemas(), listarSistemas({ incluirInativos: true })]);
  const posicao = (codigo: string) => todos.find((s) => s.codigo === codigo)?.ordem ?? Number.MAX_SAFE_INTEGER;
  const b = normalizar(filtro.busca ?? "");
  return temas
    .filter((t) => !filtro.sistema || t.sistema === filtro.sistema)
    .map((t) => comNome(t, nomeDe))
    .filter((t) => !b || [t.nome, t.sistemaNome, t.sistema, t.modulo].some((c) => normalizar(c).includes(b)))
    .sort(
      (a, c) =>
        posicao(a.sistema) - posicao(c.sistema) ||
        a.modulo.localeCompare(c.modulo, "pt-BR") ||
        a.nome.localeCompare(c.nome, "pt-BR"),
    );
}

/** Opções dos campos: sistemas ativos e módulos já usados. */
export async function sugestoes(): Promise<{ sistemas: Sistema[]; modulos: string[] }> {
  const modulos = [...new Set(temas.map((t) => t.modulo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { sistemas: await listarSistemas(), modulos };
}

/** Sistema aceito para um tema: ativo, ou o mesmo que o tema já tinha (RN-PL-02). */
export async function sistemaValido(codigo: string, temaId?: string): Promise<boolean> {
  const s = await buscarSistema(codigo);
  if (!s) return false;
  return s.ativo || temas.find((t) => t.id === temaId)?.sistema === codigo;
}

export async function temaDuplicado(d: DadosTema, excetoId?: string) {
  const chave = (t: DadosTema) => [t.nome, t.sistema, t.modulo].map(normalizar).join("|");
  return temas.some((t) => t.id !== excetoId && chave(t) === chave(d));
}

export type DadosTema = Pick<TemaRegistro, "nome" | "sistema" | "modulo">;

/** Reaproveita a grafia já cadastrada quando o módulo só difere em acento/caixa ("recepcao" → "Recepção"). */
export async function grafiaCanonica(d: DadosTema, excetoId?: string): Promise<DadosTema> {
  const outros = temas.filter((t) => t.id !== excetoId);
  return { ...d, modulo: outros.find((t) => normalizar(t.modulo) === normalizar(d.modulo))?.modulo ?? d.modulo };
}

export async function criarTema(d: DadosTema): Promise<Tema> {
  const t: TemaRegistro = { ...d, id: crypto.randomUUID(), ativo: true };
  temas.push(t);
  return comNome(t, await nomesDosSistemas());
}

export async function atualizarTema(id: string, d: DadosTema): Promise<void> {
  const t = temas.find((x) => x.id === id);
  if (t) Object.assign(t, d);
}

export async function definirTemaAtivo(id: string, ativo: boolean): Promise<void> {
  const t = temas.find((x) => x.id === id);
  if (t) t.ativo = ativo;
}
