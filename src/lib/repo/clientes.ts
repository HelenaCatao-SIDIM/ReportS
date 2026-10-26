import "server-only";
import { normalizar } from "@/lib/format";
import type { Aprovador, Cliente, Setor, Unidade } from "@/lib/types";

/*
 * Repositório de clientes, unidades e setores — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

interface Store {
  clientes: Cliente[];
  unidades: Unidade[];
  setores: Setor[];
}

function seed(): Store {
  return {
    clientes: [
      {
        id: "c1",
        nome: "Prefeitura de Vale Verde",
        cnpj: "11222333000181",
        contrato: "Contrato nº 045/2026 — Suporte e treinamento do sistema de gestão",
        nivel: "assinado",
        exigeCpf: true,
        ativo: true,
        nomesFortics: [],
        aprovadores: [
          { id: "a1", nome: "Marta Ribeiro", cargo: "Secretária de Administração", email: "marta.ribeiro@valeverde.example" },
          { id: "a2", nome: "José Antunes", cargo: "Diretor de TI", email: "jose.antunes@valeverde.example" },
        ],
      },
      {
        id: "c2",
        nome: "Clínica Bem Viver",
        cnpj: "45099719000160",
        contrato: "Contrato 2026/12 — Implantação e suporte presencial",
        nivel: "nominal",
        exigeCpf: false,
        ativo: true,
        nomesFortics: [],
        aprovadores: [{ id: "a3", nome: "Renata Lopes", cargo: "Gerente administrativa", email: "renata@bemviver.example" }],
      },
    ],
    unidades: [
      { id: "un1", clienteId: "c1", nome: "Sede da Prefeitura", endereco: "Praça Central, 100 — Centro", latitude: -22.9035, longitude: -47.0621 },
      { id: "un2", clienteId: "c1", nome: "Secretaria de Saúde", endereco: "Rua das Flores, 250 — Jardim América", latitude: null, longitude: null },
      { id: "un3", clienteId: "c2", nome: "Matriz", endereco: "Av. Brasil, 1500 — Centro", latitude: null, longitude: null },
    ],
    setores: [
      { id: "s1", unidadeId: "un1", nome: "Protocolo" },
      { id: "s2", unidadeId: "un1", nome: "Recursos Humanos" },
      { id: "s3", unidadeId: "un1", nome: "Tributação" },
      { id: "s4", unidadeId: "un2", nome: "Recepção" },
      { id: "s5", unidadeId: "un2", nome: "Farmácia" },
      { id: "s6", unidadeId: "un3", nome: "Faturamento" },
    ],
  };
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __clientes?: Store };
const db = (g.__clientes ??= seed());

const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");

// ---------- Clientes ----------

export interface ClienteResumo extends Cliente {
  totalUnidades: number;
}

export async function listarClientes(busca = ""): Promise<ClienteResumo[]> {
  const b = normalizar(busca);
  const digitos = busca.replace(/\D/g, "");
  return db.clientes
    .filter((c) => !b || normalizar(c.nome).includes(b) || (digitos.length >= 3 && c.cnpj.includes(digitos)))
    .sort(porNome)
    .map((c) => ({ ...c, totalUnidades: db.unidades.filter((u) => u.clienteId === c.id).length }));
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  return db.clientes.find((c) => c.id === id) ?? null;
}

export async function cnpjEmUso(cnpj: string, excetoId?: string) {
  return db.clientes.some((c) => c.cnpj === cnpj && c.id !== excetoId);
}

export type DadosCliente = Omit<Cliente, "id" | "aprovadores"> & { aprovadores: Omit<Aprovador, "id">[] };

const comIds = (lista: Omit<Aprovador, "id">[]): Aprovador[] => lista.map((a) => ({ ...a, id: crypto.randomUUID() }));

export async function criarCliente(dados: DadosCliente): Promise<Cliente> {
  const c: Cliente = { ...dados, id: crypto.randomUUID(), aprovadores: comIds(dados.aprovadores) };
  db.clientes.push(c);
  return c;
}

export async function atualizarCliente(id: string, dados: DadosCliente): Promise<void> {
  const c = db.clientes.find((x) => x.id === id);
  if (!c) throw new Error("Cliente não encontrado");
  Object.assign(c, dados, { aprovadores: comIds(dados.aprovadores) });
}

// ---------- Unidades ----------

export interface UnidadeComSetores extends Unidade {
  setores: Setor[];
}

export async function listarUnidades(clienteId: string): Promise<UnidadeComSetores[]> {
  return db.unidades
    .filter((u) => u.clienteId === clienteId)
    .sort(porNome)
    .map((u) => ({ ...u, setores: db.setores.filter((s) => s.unidadeId === u.id).sort(porNome) }));
}

export async function buscarUnidade(id: string): Promise<Unidade | null> {
  return db.unidades.find((u) => u.id === id) ?? null;
}

export type DadosUnidade = Omit<Unidade, "id" | "clienteId">;

export async function criarUnidade(clienteId: string, dados: DadosUnidade): Promise<Unidade> {
  const u: Unidade = { ...dados, id: crypto.randomUUID(), clienteId };
  db.unidades.push(u);
  return u;
}

export async function atualizarUnidade(id: string, dados: DadosUnidade): Promise<void> {
  const u = db.unidades.find((x) => x.id === id);
  if (u) Object.assign(u, dados);
}

/** Remove a unidade e os seus setores. (Com visitas registradas, passará a ser bloqueado.) */
export async function removerUnidade(id: string): Promise<void> {
  db.unidades = db.unidades.filter((u) => u.id !== id);
  db.setores = db.setores.filter((s) => s.unidadeId !== id);
}

// ---------- Setores ----------

export async function buscarSetor(id: string): Promise<Setor | null> {
  return db.setores.find((s) => s.id === id) ?? null;
}

export async function setorDuplicado(unidadeId: string, nome: string, excetoId?: string) {
  const n = normalizar(nome);
  return db.setores.some((s) => s.unidadeId === unidadeId && normalizar(s.nome) === n && s.id !== excetoId);
}

export async function criarSetor(unidadeId: string, nome: string): Promise<Setor> {
  const s: Setor = { id: crypto.randomUUID(), unidadeId, nome };
  db.setores.push(s);
  return s;
}

export async function renomearSetor(id: string, nome: string): Promise<void> {
  const s = db.setores.find((x) => x.id === id);
  if (s) s.nome = nome;
}

/** (Com visitas registradas, passará a ser bloqueado.) */
export async function removerSetor(id: string): Promise<void> {
  db.setores = db.setores.filter((s) => s.id !== id);
}

// ---------- Check-in ----------

export interface ClienteCheckin {
  id: string;
  nome: string;
  unidades: { id: string; nome: string; endereco: string; setores: { id: string; nome: string }[] }[];
}

/** Clientes ativos que têm ao menos uma unidade, com unidades e setores — para a escolha em cascata no check-in. */
export async function listarParaCheckin(): Promise<ClienteCheckin[]> {
  const clientes = db.clientes.filter((c) => c.ativo).sort(porNome);
  const resultado: ClienteCheckin[] = [];
  for (const c of clientes) {
    const unidades = await listarUnidades(c.id);
    if (!unidades.length) continue;
    resultado.push({
      id: c.id,
      nome: c.nome,
      unidades: unidades.map((u) => ({ id: u.id, nome: u.nome, endereco: u.endereco, setores: u.setores.map((s) => ({ id: s.id, nome: s.nome })) })),
    });
  }
  return resultado;
}
