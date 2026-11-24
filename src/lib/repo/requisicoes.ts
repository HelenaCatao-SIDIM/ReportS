import "server-only";
import { idPlataforma, idTexto, reports } from "@/lib/db";
import type { DesfechoRequisicao, RegistroRequisicao } from "@/lib/types";

/*
 * Log de requisições: o que entra pelo proxy e o desfecho dele. O proxy chama `registrarRequisicao` em segundo plano
 * (event.waitUntil) a cada requisição; é só gravação e leitura. Guarda 30 dias — a faxina roda de vez em quando, junto
 * com a gravação, para a tabela não crescer sem fim mesmo que ninguém abra a tela.
 *
 * O usuário vem do cookie de sessão (só o id); o nome é resolvido na leitura (a gravação não pode pesar nem puxar o
 * `bcryptjs` para o bundle do proxy — por isso os nomes entram por import dinâmico).
 */

/** Teto de linhas lidas (as mais recentes); a tela avisa quando bate o teto. */
export const LIMITE_REQUISICOES = 500;
const DIAS_RETENCAO = 30;

export interface EntradaRequisicao {
  metodo: string;
  caminho: string;
  /** Id do usuário logado (do cookie de sessão), ou null. */
  usuarioId: string | null;
  ip: string;
  desfecho: DesfechoRequisicao;
}

/** Grava uma linha do log. Nunca derruba a requisição: em caso de erro, só registra no servidor. */
export async function registrarRequisicao(e: EntradaRequisicao): Promise<void> {
  try {
    await reports.requisicao.create({
      data: {
        id: crypto.randomUUID(),
        em: new Date(),
        metodo: e.metodo.slice(0, 10),
        caminho: e.caminho.slice(0, 300),
        usuarioId: idPlataforma(e.usuarioId),
        ip: e.ip.slice(0, 60),
        desfecho: e.desfecho,
      },
    });
    if (Math.random() < 0.01) await apagarAntigas();
  } catch (err) {
    console.error("[requisicoes] falha ao registrar", e.metodo, e.caminho, err);
  }
}

/** Apaga as linhas com mais de `dias` dias (padrão: 30). */
export async function apagarAntigas(dias = DIAS_RETENCAO): Promise<void> {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  await reports.requisicao.deleteMany({ where: { em: { lt: limite } } });
}

export interface FiltroRequisicoes {
  metodo?: string;
  desfecho?: DesfechoRequisicao;
  /** Busca no caminho (sem diferenciar maiúsculas). */
  texto?: string;
  /** ISO inclusive. */
  de?: string;
  ate?: string;
}

/** As requisições, da mais recente para a mais antiga, com o nome do usuário resolvido. */
export async function listarRequisicoes(f: FiltroRequisicoes = {}): Promise<RegistroRequisicao[]> {
  const texto = f.texto?.trim();
  const linhas = await reports.requisicao.findMany({
    where: {
      ...(f.metodo ? { metodo: f.metodo } : {}),
      ...(f.desfecho ? { desfecho: f.desfecho } : {}),
      ...(texto ? { caminho: { contains: texto, mode: "insensitive" } } : {}),
      ...(f.de || f.ate ? { em: { ...(f.de ? { gte: new Date(f.de) } : {}), ...(f.ate ? { lte: new Date(f.ate) } : {}) } } : {}),
    },
    orderBy: { em: "desc" },
    take: LIMITE_REQUISICOES,
  });
  const { nomesDosUsuarios } = await import("./usuarios");
  const nomes = await nomesDosUsuarios(linhas.filter((l) => l.usuarioId !== null).map((l) => idTexto(l.usuarioId!)));
  return linhas.map((l) => ({
    id: l.id,
    em: l.em.toISOString(),
    metodo: l.metodo,
    caminho: l.caminho,
    usuarioNome: l.usuarioId !== null ? (nomes.get(idTexto(l.usuarioId)) ?? "—") : "—",
    ip: l.ip,
    desfecho: l.desfecho as DesfechoRequisicao,
  }));
}
