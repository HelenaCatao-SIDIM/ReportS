import "server-only";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { normalizar } from "@/lib/format";
import type { Cliente, SistemaDoCliente, Setor, Unidade } from "@/lib/types";
import { buscarSistema, listarSistemas, nomesDosSistemas } from "./sistemas";

/*
 * Repositório de clientes, sistemas do cliente, estabelecimentos e setores — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

interface Store {
  clientes: Cliente[];
  sistemasDoCliente: SistemaDoCliente[];
  unidades: Unidade[];
  setores: Setor[];
}

function seed(): Store {
  return {
    clientes: [
      { id: "c1", nome: "Prefeitura de Vale Verde", cnpj: "11222333000181", ativo: true, origem: "manual", nomesFortics: [] },
      { id: "c2", nome: "Clínica Bem Viver", cnpj: "45099719000160", ativo: true, origem: "manual", nomesFortics: [] },
    ],
    sistemasDoCliente: [
      { id: "sc1", clienteId: "c1", sistema: "serp", tenantId: "valeverde", estado: "vinculado" },
      { id: "sc2", clienteId: "c1", sistema: "sca", tenantId: "valeverde", estado: "vinculado" },
      { id: "sc3", clienteId: "c1", sistema: "saude", tenantId: null, estado: "em_implantacao" },
      { id: "sc4", clienteId: "c2", sistema: "saude", tenantId: "bemviver", estado: "vinculado" },
    ],
    unidades: [
      { id: "un1", clienteId: "c1", nome: "Sede da Prefeitura", endereco: "Praça Central, 100 — Centro", latitude: -22.9035, longitude: -47.0621, raioMetros: RAIO_PADRAO_METROS },
      { id: "un2", clienteId: "c1", nome: "Secretaria de Saúde", endereco: "Rua das Flores, 250 — Jardim América", latitude: null, longitude: null, raioMetros: RAIO_PADRAO_METROS },
      { id: "un3", clienteId: "c2", nome: "Matriz", endereco: "Av. Brasil, 1500 — Centro", latitude: null, longitude: null, raioMetros: RAIO_PADRAO_METROS },
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
const g = globalThis as unknown as { __clientesV2?: Store };
const db = (g.__clientesV2 ??= seed());

const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");

// ---------- Clientes ----------

export interface ClienteResumo extends Cliente {
  totalUnidades: number;
  /** Sistemas do cliente, na ordem do cadastro de sistemas. */
  sistemas: (SistemaDoCliente & { sistemaNome: string })[];
}

const resumir = async (c: Cliente): Promise<ClienteResumo> => ({
  ...c,
  totalUnidades: db.unidades.filter((u) => u.clienteId === c.id).length,
  sistemas: await listarSistemasDoCliente(c.id),
});

export async function listarClientes(busca = ""): Promise<ClienteResumo[]> {
  const b = normalizar(busca);
  const digitos = busca.replace(/\D/g, "");
  const achados = db.clientes
    .filter((c) => !b || normalizar(c.nome).includes(b) || (digitos.length >= 3 && c.cnpj.includes(digitos)))
    .sort(porNome);
  return Promise.all(achados.map(resumir));
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  return db.clientes.find((c) => c.id === id) ?? null;
}

export async function cnpjEmUso(cnpj: string, excetoId?: string) {
  return !!cnpj && db.clientes.some((c) => c.cnpj === cnpj && c.id !== excetoId);
}

export type DadosCliente = Pick<Cliente, "nome" | "cnpj" | "ativo" | "nomesFortics">;

/**
 * Cria o cliente à mão (implantação) com os sistemas informados em implantação.
 * Ordem das gravações: cliente, depois sistemas do cliente; o contrato vem depois, no repositório de contratos.
 */
export async function criarCliente(dados: DadosCliente, sistemas: string[]): Promise<Cliente> {
  const c: Cliente = { ...dados, id: crypto.randomUUID(), origem: "manual" };
  db.clientes.push(c);
  for (const codigo of new Set(sistemas)) await adicionarSistemaAoCliente(c.id, codigo);
  return c;
}

export async function atualizarCliente(id: string, dados: DadosCliente): Promise<void> {
  const c = db.clientes.find((x) => x.id === id);
  if (!c) throw new Error("Cliente não encontrado");
  Object.assign(c, dados);
}

// ---------- Sistemas do cliente ----------

/** Sistemas do cliente com o nome do sistema, na ordem do cadastro de sistemas. */
export async function listarSistemasDoCliente(clienteId: string): Promise<(SistemaDoCliente & { sistemaNome: string })[]> {
  const [nomeDe, todos] = await Promise.all([nomesDosSistemas(), listarSistemas({ incluirInativos: true })]);
  const posicao = (codigo: string) => todos.find((s) => s.codigo === codigo)?.ordem ?? Number.MAX_SAFE_INTEGER;
  return db.sistemasDoCliente
    .filter((x) => x.clienteId === clienteId)
    .sort((a, b) => posicao(a.sistema) - posicao(b.sistema))
    .map((x) => ({ ...x, sistemaNome: nomeDe(x.sistema) }));
}

export async function buscarSistemaDoCliente(id: string): Promise<(SistemaDoCliente & { sistemaNome: string }) | null> {
  const x = db.sistemasDoCliente.find((s) => s.id === id);
  if (!x) return null;
  return { ...x, sistemaNome: (await nomesDosSistemas())(x.sistema) };
}

/** Um cliente tem no máximo um registro por sistema (RN-PL-27). */
export async function clienteTemSistema(clienteId: string, codigo: string) {
  return db.sistemasDoCliente.some((x) => x.clienteId === clienteId && x.sistema === codigo);
}

/** Acrescenta um sistema "em implantação" ao cliente. A ligação com o tenant é feita no SINC. */
export async function adicionarSistemaAoCliente(clienteId: string, codigo: string): Promise<SistemaDoCliente> {
  const sistema = await buscarSistema(codigo);
  if (!sistema?.ativo) throw new Error("Sistema inválido ou desativado");
  if (await clienteTemSistema(clienteId, codigo)) throw new Error("O cliente já tem este sistema");
  const x: SistemaDoCliente = { id: crypto.randomUUID(), clienteId, sistema: codigo, tenantId: null, estado: "em_implantacao" };
  db.sistemasDoCliente.push(x);
  return x;
}

// ---------- Estabelecimentos ----------

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

/** Remove o estabelecimento e os seus setores. (Com visitas registradas, passará a ser bloqueado.) */
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
