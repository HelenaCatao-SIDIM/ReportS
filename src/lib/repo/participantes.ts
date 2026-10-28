import "server-only";
import { normalizar } from "@/lib/format";
import type { Participante } from "@/lib/types";

/*
 * Repositório de participantes — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

function seed(): Participante[] {
  const p = (id: string, clienteId: string, nome: string, cbo: [string, string], setor: string, cpf: string | null, criadoEmCampo = false): Participante => ({
    id, clienteId, nome, cbo: { codigo: cbo[0], titulo: cbo[1] }, setor, cpf, criadoEmCampo,
  });
  return [
    p("p1", "c1", "Luciana Ferraz", ["411010", "Assistente administrativo"], "Protocolo", "12345678909"),
    p("p2", "c1", "Rogério Batista", ["411010", "Assistente administrativo"], "Tributação", "98765432100"),
    p("p3", "c1", "Patrícia Gomes", ["252405", "Analista de recursos humanos"], "Recursos Humanos", "11144477735"),
    p("p4", "c1", "Sandra Moura", ["223505", "Enfermeiro"], "Recepção", "52998224725", true),
    p("p5", "c2", "Fábio Nunes", ["411005", "Auxiliar de escritório"], "Faturamento", null),
    p("p6", "c2", "Cíntia Alves", ["422105", "Recepcionista, em geral"], "Recepção", null, true),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __participantes?: Participante[] };
const participantes = (g.__participantes ??= seed());

/** Participantes de um cliente, com busca por nome, ocupação (CBO) ou setor. */
export async function listarParticipantes(clienteId: string, busca = ""): Promise<Participante[]> {
  const b = normalizar(busca);
  return participantes
    .filter((p) => p.clienteId === clienteId)
    .filter((p) => !b || [p.nome, p.cbo.titulo, p.setor].some((c) => normalizar(c).includes(b)))
    .sort((a, b2) => a.nome.localeCompare(b2.nome, "pt-BR"));
}

export async function buscarParticipante(id: string): Promise<Participante | null> {
  return participantes.find((p) => p.id === id) ?? null;
}

export async function homonimo(clienteId: string, nome: string, excetoId?: string) {
  const n = normalizar(nome);
  return participantes.some((p) => p.clienteId === clienteId && p.id !== excetoId && normalizar(p.nome) === n);
}

export async function cpfEmUso(clienteId: string, cpf: string, excetoId?: string) {
  return participantes.some((p) => p.clienteId === clienteId && p.id !== excetoId && p.cpf === cpf);
}

export type DadosParticipante = Omit<Participante, "id" | "clienteId" | "criadoEmCampo">;

export async function criarParticipante(clienteId: string, d: DadosParticipante, criadoEmCampo = false): Promise<Participante> {
  const p: Participante = { ...d, id: crypto.randomUUID(), clienteId, criadoEmCampo };
  participantes.push(p);
  return p;
}

export async function atualizarParticipante(id: string, d: DadosParticipante): Promise<void> {
  const p = participantes.find((x) => x.id === id);
  if (p) Object.assign(p, d);
}
