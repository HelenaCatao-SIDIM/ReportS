import "server-only";
import type { Aprovador, Cliente, Contrato, EstadoSistemaCliente, NivelComprovacao } from "@/lib/types";
import { buscarAprovadoresPorIds } from "./aprovadores";
import { buscarCliente, buscarSistemaDoCliente, listarClientes, listarSistemasDoCliente, listarUnidades } from "./clientes";

/*
 * Repositório de contratos — implementação MOCK em memória.
 * Um contrato por sistema do cliente (D-14). Na fase de banco, só este arquivo muda (Prisma/Postgres).
 */

function seed(): Contrato[] {
  return [
    {
      id: "ct1", sistemaDoClienteId: "sc1", texto: "Contrato nº 045/2026 — Suporte e treinamento do sistema de gestão",
      nivel: "assinado", exigeCpf: true, ativo: true, aprovadorIds: ["a1", "a2"],
    },
    {
      id: "ct2", sistemaDoClienteId: "sc2", texto: "Contrato nº 046/2026 — Treinamento e suporte do sistema de pessoal e folha",
      nivel: "assinado", exigeCpf: true, ativo: true, aprovadorIds: ["a1"],
    },
    {
      id: "ct3", sistemaDoClienteId: "sc3", texto: "Contrato nº 047/2026 — Implantação do sistema de saúde",
      nivel: "nominal", exigeCpf: true, ativo: true, aprovadorIds: ["a1", "a4"],
    },
    {
      id: "ct4", sistemaDoClienteId: "sc4", texto: "Contrato 2026/12 — Implantação e suporte presencial",
      nivel: "nominal", exigeCpf: false, ativo: true, aprovadorIds: ["a3"],
    },
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const g = globalThis as unknown as { __contratos?: Contrato[] };
const contratos = (g.__contratos ??= seed());

/** Contrato com cliente, sistema e aprovadores resolvidos. */
export interface ContratoDetalhado extends Contrato {
  clienteId: string;
  clienteNome: string;
  clienteAtivo: boolean;
  /** Código e nome do sistema. */
  sistema: string;
  sistemaNome: string;
  estadoSistema: EstadoSistemaCliente;
  tenantId: string | null;
  /** Aprovadores cadastrados no contrato (ativos ou não). */
  aprovadores: Aprovador[];
}

async function detalhar(c: Contrato): Promise<ContratoDetalhado | null> {
  const sdc = await buscarSistemaDoCliente(c.sistemaDoClienteId);
  if (!sdc) return null;
  const cliente = await buscarCliente(sdc.clienteId);
  if (!cliente) return null;
  return {
    ...c,
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    clienteAtivo: cliente.ativo,
    sistema: sdc.sistema,
    sistemaNome: sdc.sistemaNome,
    estadoSistema: sdc.estado,
    tenantId: sdc.tenantId,
    aprovadores: await buscarAprovadoresPorIds(c.aprovadorIds),
  };
}

export async function buscarContrato(id: string): Promise<ContratoDetalhado | null> {
  const c = contratos.find((x) => x.id === id);
  return c ? detalhar(c) : null;
}

/** Contrato de um sistema do cliente (no máximo um). */
export async function buscarContratoDoSistemaDoCliente(sistemaDoClienteId: string): Promise<ContratoDetalhado | null> {
  const c = contratos.find((x) => x.sistemaDoClienteId === sistemaDoClienteId);
  return c ? detalhar(c) : null;
}

/** Contratos do cliente, na ordem dos sistemas. */
export async function listarContratosDoCliente(clienteId: string): Promise<ContratoDetalhado[]> {
  const sistemas = await listarSistemasDoCliente(clienteId);
  const lista: ContratoDetalhado[] = [];
  for (const s of sistemas) {
    const c = contratos.find((x) => x.sistemaDoClienteId === s.id);
    const d = c && (await detalhar(c));
    if (d) lista.push(d);
  }
  return lista;
}

/** Todos os contratos, por cliente (para listas). */
export async function listarContratos(): Promise<ContratoDetalhado[]> {
  const todos = await Promise.all(contratos.map(detalhar));
  return todos.filter((c): c is ContratoDetalhado => !!c);
}

export interface DadosContrato {
  texto: string;
  nivel: NivelComprovacao;
  exigeCpf: boolean;
  ativo: boolean;
  aprovadorIds: string[];
}

/** Cria o contrato do sistema do cliente, ou atualiza o que já existe. */
export async function salvarContrato(sistemaDoClienteId: string, d: DadosContrato): Promise<Contrato> {
  const existente = contratos.find((x) => x.sistemaDoClienteId === sistemaDoClienteId);
  const dados = { ...d, aprovadorIds: [...new Set(d.aprovadorIds)] };
  if (existente) {
    Object.assign(existente, dados);
    return existente;
  }
  const novo: Contrato = { id: crypto.randomUUID(), sistemaDoClienteId, ...dados };
  contratos.push(novo);
  return novo;
}

/** Quantos contratos citam o aprovador (para a tela de aprovadores). */
export async function contratosDoAprovador(aprovadorId: string): Promise<ContratoDetalhado[]> {
  const citam = contratos.filter((c) => c.aprovadorIds.includes(aprovadorId));
  const lista = await Promise.all(citam.map(detalhar));
  return lista.filter((c): c is ContratoDetalhado => !!c);
}

/** Aprovadores ativos do contrato (quem recebe o relatório). */
export async function aprovadoresAtivosDoContrato(contratoId: string): Promise<Aprovador[]> {
  const c = await buscarContrato(contratoId);
  return c ? c.aprovadores.filter((a) => a.ativo) : [];
}

// ---------- Check-in ----------

export interface ClienteCheckin {
  id: string;
  nome: string;
  /** Contratos ativos de sistemas do cliente: o técnico escolhe o sistema e, com ele, o contrato. */
  contratos: { id: string; sistemaNome: string }[];
  unidades: { id: string; nome: string; endereco: string; setores: { id: string; nome: string }[] }[];
}

/** Clientes ativos com ao menos um contrato ativo e um estabelecimento — para a escolha em cascata no check-in. */
export async function listarParaCheckin(): Promise<ClienteCheckin[]> {
  const clientes = (await listarClientes()).filter((c: Cliente) => c.ativo);
  const resultado: ClienteCheckin[] = [];
  for (const c of clientes) {
    const [unidades, doCliente] = await Promise.all([listarUnidades(c.id), listarContratosDoCliente(c.id)]);
    const ativos = doCliente.filter((x) => x.ativo);
    if (!unidades.length || !ativos.length) continue;
    resultado.push({
      id: c.id,
      nome: c.nome,
      contratos: ativos.map((x) => ({ id: x.id, sistemaNome: x.sistemaNome })),
      unidades: unidades.map((u) => ({ id: u.id, nome: u.nome, endereco: u.endereco, setores: u.setores.map((s) => ({ id: s.id, nome: s.nome })) })),
    });
  }
  return resultado;
}
