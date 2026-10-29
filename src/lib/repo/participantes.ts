import "server-only";
import { normalizar } from "@/lib/format";
import { nomesParecidos } from "@/lib/similaridade";
import type { OrigemParticipante, Participante } from "@/lib/types";

/*
 * Repositório de participantes — implementação MOCK em memória.
 * O confirmado nasce da captura do painel do SINC (aqui, só nos dados de exemplo); o provisório nasce no ReportS.
 * Na fase de banco, só este arquivo muda (leitura e escrita na plataforma).
 */

function seed(): Participante[] {
  const p = (
    id: string, sistemaDoClienteId: string, idErp: string | null, nome: string, cbo: [string, string], setor: string, cpf: string | null, origem: OrigemParticipante,
  ): Participante => ({
    id, sistemaDoClienteId, idErp, estado: idErp ? "confirmado" : "provisorio", origem, nome, cbo: { codigo: cbo[0], titulo: cbo[1] }, setor, cpf,
  });
  return [
    // Prefeitura de Vale Verde: SERP (sc1), SCA (sc2), Saúde (sc3)
    p("p1", "sc1", "1021", "Luciana Ferraz", ["411010", "Assistente administrativo"], "Protocolo", "12345678909", "painel_sinc"),
    p("p2", "sc1", "1034", "Rogério Batista", ["411010", "Assistente administrativo"], "Tributação", "98765432100", "painel_sinc"),
    p("p3", "sc2", "2005", "Patrícia Gomes", ["252405", "Analista de recursos humanos"], "Recursos Humanos", "11144477735", "painel_sinc"),
    p("p7", "sc2", null, "Eduardo Pires", ["411010", "Assistente administrativo"], "Recursos Humanos", "39053344705", "cadastro_reports"),
    p("p4", "sc3", null, "Sandra Moura", ["223505", "Enfermeiro"], "Recepção", "52998224725", "campo_reports"),
    // Clínica Bem Viver: Saúde (sc4)
    p("p5", "sc4", "3001", "Fábio Nunes", ["411005", "Auxiliar de escritório"], "Faturamento", null, "painel_sinc"),
    p("p6", "sc4", null, "Cíntia Alves", ["422105", "Recepcionista, em geral"], "Recepção", null, "campo_reports"),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __participantesV2?: Participante[] };
const participantes = (g.__participantesV2 ??= seed());

/** Participantes de um sistema do cliente, com busca por nome, ocupação (CBO) ou setor. */
export async function listarParticipantes(sistemaDoClienteId: string, busca = ""): Promise<Participante[]> {
  const b = normalizar(busca);
  return participantes
    .filter((p) => p.sistemaDoClienteId === sistemaDoClienteId)
    .filter((p) => !b || [p.nome, p.cbo.titulo, p.setor].some((c) => normalizar(c).includes(b)))
    .sort((a, b2) => a.nome.localeCompare(b2.nome, "pt-BR"));
}

export async function buscarParticipante(id: string): Promise<Participante | null> {
  return participantes.find((p) => p.id === id) ?? null;
}

export async function cpfEmUso(sistemaDoClienteId: string, cpf: string, excetoId?: string) {
  return participantes.some((p) => p.sistemaDoClienteId === sistemaDoClienteId && p.id !== excetoId && p.cpf === cpf);
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
  const doSistema = participantes.filter((p) => p.sistemaDoClienteId === sistemaDoClienteId && p.id !== excetoId);
  return {
    mesmoCpf: d.cpf ? (doSistema.find((p) => p.cpf === d.cpf) ?? null) : null,
    nomesParecidos: doSistema.filter((p) => nomesParecidos(p.nome, d.nome)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

export type DadosParticipante = Pick<Participante, "nome" | "cbo" | "setor" | "cpf">;

/** Cria um participante provisório (sem id do ERP): pelo técnico em campo ou pela Administração. */
export async function criarProvisorio(sistemaDoClienteId: string, d: DadosParticipante, origem: Exclude<OrigemParticipante, "painel_sinc">): Promise<Participante> {
  const p: Participante = { ...d, id: crypto.randomUUID(), sistemaDoClienteId, idErp: null, estado: "provisorio", origem };
  participantes.push(p);
  return p;
}

/** Atualiza CBO, setor e CPF. O nome só muda no provisório: o do confirmado vem do ERP (RN-PL-42). */
export async function atualizarParticipante(id: string, d: DadosParticipante): Promise<void> {
  const p = participantes.find((x) => x.id === id);
  if (!p) return;
  const { nome, ...resto } = d;
  Object.assign(p, resto);
  if (p.estado === "provisorio") p.nome = nome;
}
