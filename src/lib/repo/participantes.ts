import "server-only";
import { idPlataforma, idTexto, plataforma } from "@/lib/db";
import { normalizar } from "@/lib/format";
import { nomesParecidos } from "@/lib/similaridade";
import type { EstadoParticipante, OrigemParticipante, Participante } from "@/lib/types";

/*
 * Participantes — tabela `client_users` da plataforma, comum com o SINC.
 * O confirmado nasce da captura do painel do SINC (com o id do usuário no ERP); o provisório nasce no ReportS.
 * Os unidos (Fase 5) ficam de fora. O ReportS grava só nome (do provisório), CPF, CBO e setor (ADR-035 do SINC);
 * a inclusão é em SQL direto para não mandar as colunas com valor padrão, que ele não pode gravar.
 */

const VISIVEL = { estado: { in: ["confirmado", "provisorio"] } };

type Linha = Awaited<ReturnType<typeof plataforma.client_users.findFirstOrThrow>>;

const paraParticipante = (p: Linha): Participante => ({
  id: idTexto(p.id),
  sistemaDoClienteId: idTexto(p.client_id),
  idErp: p.external_user_id,
  estado: p.estado as EstadoParticipante,
  origem: p.origem as OrigemParticipante,
  // O confirmado sem nome no ERP aparece pelo id do ERP.
  nome: p.nome ?? (p.external_user_id ? `Usuário ${p.external_user_id} do ERP` : ""),
  // Os confirmados chegam do SINC sem ocupação; ela é preenchida no ReportS.
  cbo: p.cbo_codigo ? { codigo: p.cbo_codigo, titulo: p.cbo_titulo ?? "" } : null,
  setor: p.setor ?? "",
  cpf: p.cpf,
});

const porNome = (a: Participante, b: Participante) => a.nome.localeCompare(b.nome, "pt-BR");

async function doSistemaDoCliente(sistemaDoClienteId: string, excetoId?: string): Promise<Participante[]> {
  const chave = idPlataforma(sistemaDoClienteId);
  if (chave === null) return [];
  const linhas = await plataforma.client_users.findMany({
    where: { client_id: chave, ...VISIVEL, NOT: { id: idPlataforma(excetoId) ?? BigInt(-1) } },
  });
  return linhas.map(paraParticipante);
}

/** Participantes de um sistema do cliente, com busca por nome, ocupação (CBO) ou setor. */
export async function listarParticipantes(sistemaDoClienteId: string, busca = ""): Promise<Participante[]> {
  const b = normalizar(busca);
  return (await doSistemaDoCliente(sistemaDoClienteId))
    .filter((p) => !b || [p.nome, p.cbo?.titulo ?? "", p.setor].some((c) => normalizar(c).includes(b)))
    .sort(porNome);
}

export async function buscarParticipante(id: string): Promise<Participante | null> {
  const chave = idPlataforma(id);
  if (chave === null) return null;
  const p = await plataforma.client_users.findFirst({ where: { id: chave, ...VISIVEL } });
  return p ? paraParticipante(p) : null;
}

/** CPF é único por sistema do cliente entre os não unidos (o banco também garante). */
export async function cpfEmUso(sistemaDoClienteId: string, cpf: string, excetoId?: string) {
  return (await doSistemaDoCliente(sistemaDoClienteId, excetoId)).some((p) => p.cpf === cpf);
}

export interface Semelhantes {
  /** Quem já tem este CPF no sistema do cliente (bloqueia a criação). */
  mesmoCpf: Participante | null;
  /** Nomes iguais ou parecidos (sem acento; semelhança de pelo menos 0,75, como no SINC). */
  nomesParecidos: Participante[];
}

/**
 * Busca antes de criar (RN-PL-34): procura, entre os participantes do mesmo sistema do cliente, quem já tem o CPF
 * e quem tem nome igual ou parecido.
 */
export async function buscarSemelhantes(sistemaDoClienteId: string, d: { nome: string; cpf?: string | null }, excetoId?: string): Promise<Semelhantes> {
  const doSistema = await doSistemaDoCliente(sistemaDoClienteId, excetoId);
  return {
    mesmoCpf: d.cpf ? (doSistema.find((p) => p.cpf === d.cpf) ?? null) : null,
    nomesParecidos: doSistema.filter((p) => nomesParecidos(p.nome, d.nome)).sort(porNome),
  };
}

export type DadosParticipante = { nome: string; cbo: NonNullable<Participante["cbo"]>; setor: string; cpf: string | null };

/** Cria um participante provisório (sem id do ERP): pelo técnico em campo ou pela Administração. */
export async function criarProvisorio(
  sistemaDoClienteId: string,
  d: DadosParticipante,
  origem: Exclude<OrigemParticipante, "painel_sinc">,
  criadoPor: string,
): Promise<Participante> {
  const [{ id }] = await plataforma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO client_users (client_id, nome, estado, origem, cpf, cbo_codigo, cbo_titulo, setor, criado_por_user_id)
    VALUES (${idPlataforma(sistemaDoClienteId)}, ${d.nome}, 'provisorio', ${origem}, ${d.cpf}, ${d.cbo.codigo}, ${d.cbo.titulo},
            ${d.setor || null}, ${idPlataforma(criadoPor)})
    RETURNING id`;
  return (await buscarParticipante(idTexto(id)))!;
}

/** Grava só o CPF, informado na presença (RN-PL-35). Não mexe em nome, CBO nem setor, que o confirmado pode ter vazios. */
export async function definirCpfDoParticipante(id: string, cpf: string): Promise<void> {
  await plataforma.client_users.update({ where: { id: idPlataforma(id)! }, data: { cpf, updated_at: new Date() } });
}

/** Atualiza CBO, setor e CPF. O nome só muda no provisório: o do confirmado vem do ERP (RN-PL-42). */
export async function atualizarParticipante(id: string, d: DadosParticipante): Promise<void> {
  const atual = await buscarParticipante(id);
  if (!atual) return;
  await plataforma.client_users.update({
    where: { id: idPlataforma(id)! },
    data: {
      ...(atual.estado === "provisorio" ? { nome: d.nome } : {}),
      cpf: d.cpf,
      cbo_codigo: d.cbo.codigo,
      cbo_titulo: d.cbo.titulo,
      setor: d.setor || null,
      updated_at: new Date(),
    },
  });
}
