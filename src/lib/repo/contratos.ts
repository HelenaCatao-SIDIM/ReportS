import "server-only";
import { idPlataforma, idTexto, plataforma, reports } from "@/lib/db";
import type { Aprovador, Contrato, EstadoSistemaCliente, NivelComprovacao } from "@/lib/types";
import { buscarSistemaDoCliente, listarSistemasDoCliente } from "./clientes";
import { nomesDosSistemas } from "./sistemas";

/*
 * Contratos — banco do ReportS. Um contrato por sistema do cliente (D-14). O sistema do cliente e o cliente são da
 * plataforma: o contrato guarda os dois ids e lê os nomes de lá.
 */

const INCLUIR = { aprovadores: { orderBy: { ordem: "asc" }, include: { aprovador: true } } } as const;

type Linha = Awaited<ReturnType<typeof reports.contrato.findFirstOrThrow<{ include: typeof INCLUIR }>>>;

const paraAprovador = (a: Linha["aprovadores"][number]["aprovador"]): Aprovador => ({ id: a.id, nome: a.nome, cargo: a.cargo, email: a.email, ativo: a.ativo });

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

/** Resolve os dados da plataforma de vários contratos com uma consulta. Some o contrato cujo sistema do cliente saiu de vista. */
async function detalhar(linhas: Linha[]): Promise<ContratoDetalhado[]> {
  if (!linhas.length) return [];
  const [sistemas, nomeDe] = await Promise.all([
    plataforma.clients.findMany({
      where: { id: { in: linhas.map((c) => c.sistemaDoClienteId) }, customer_id: { not: null }, estado: { in: ["em_implantacao", "vinculado"] } },
      select: { id: true, sistema: true, tenant_id: true, estado: true, customers: { select: { id: true, nome: true, ativo: true } } },
    }),
    nomesDosSistemas(),
  ]);
  const porId = new Map(sistemas.map((s) => [s.id, s]));
  return linhas.flatMap((c) => {
    const sdc = porId.get(c.sistemaDoClienteId);
    if (!sdc?.customers) return [];
    return [
      {
        id: c.id,
        sistemaDoClienteId: idTexto(c.sistemaDoClienteId),
        texto: c.texto,
        nivel: c.nivel as NivelComprovacao,
        exigeCpf: c.exigeCpf,
        ativo: c.ativo,
        aprovadorIds: c.aprovadores.map((a) => a.aprovadorId),
        clienteId: idTexto(sdc.customers.id),
        clienteNome: sdc.customers.nome,
        clienteAtivo: sdc.customers.ativo,
        sistema: sdc.sistema,
        sistemaNome: nomeDe(sdc.sistema),
        estadoSistema: sdc.estado as EstadoSistemaCliente,
        tenantId: sdc.tenant_id,
        aprovadores: c.aprovadores.map((a) => paraAprovador(a.aprovador)),
      },
    ];
  });
}

export async function buscarContrato(id: string): Promise<ContratoDetalhado | null> {
  const c = await reports.contrato.findUnique({ where: { id }, include: INCLUIR });
  return c ? ((await detalhar([c]))[0] ?? null) : null;
}

/** Contrato de um sistema do cliente (no máximo um). */
export async function buscarContratoDoSistemaDoCliente(sistemaDoClienteId: string): Promise<ContratoDetalhado | null> {
  const chave = idPlataforma(sistemaDoClienteId);
  if (chave === null) return null;
  const c = await reports.contrato.findUnique({ where: { sistemaDoClienteId: chave }, include: INCLUIR });
  return c ? ((await detalhar([c]))[0] ?? null) : null;
}

/** Contratos do cliente, na ordem dos sistemas. */
export async function listarContratosDoCliente(clienteId: string): Promise<ContratoDetalhado[]> {
  const chave = idPlataforma(clienteId);
  if (chave === null) return [];
  const [sistemas, linhas] = await Promise.all([
    listarSistemasDoCliente(clienteId),
    reports.contrato.findMany({ where: { clienteId: chave }, include: INCLUIR }),
  ]);
  const ordem = new Map(sistemas.map((s, i) => [s.id, i]));
  return (await detalhar(linhas))
    .filter((c) => ordem.has(c.sistemaDoClienteId))
    .sort((a, b) => ordem.get(a.sistemaDoClienteId)! - ordem.get(b.sistemaDoClienteId)!);
}

/** Todos os contratos (para listas). */
export async function listarContratos(): Promise<ContratoDetalhado[]> {
  return detalhar(await reports.contrato.findMany({ include: INCLUIR }));
}

export interface DadosContrato {
  texto: string;
  nivel: NivelComprovacao;
  exigeCpf: boolean;
  ativo: boolean;
  aprovadorIds: string[];
}

/**
 * Cria o contrato do sistema do cliente, ou atualiza o que já existe. É a última gravação ao criar um cliente:
 * cliente e sistema do cliente já estão na plataforma.
 */
export async function salvarContrato(sistemaDoClienteId: string, d: DadosContrato): Promise<Contrato> {
  const sdc = await buscarSistemaDoCliente(sistemaDoClienteId);
  if (!sdc) throw new Error("Sistema do cliente não encontrado");
  const chave = idPlataforma(sistemaDoClienteId)!;
  const aprovadorIds = [...new Set(d.aprovadorIds)];
  const dados = { texto: d.texto, nivel: d.nivel, exigeCpf: d.exigeCpf, ativo: d.ativo };
  const c = await reports.$transaction(async (tx) => {
    const salvo = await tx.contrato.upsert({
      where: { sistemaDoClienteId: chave },
      create: { id: crypto.randomUUID(), clienteId: idPlataforma(sdc.clienteId)!, sistemaDoClienteId: chave, ...dados },
      update: dados,
    });
    await tx.contratoAprovador.deleteMany({ where: { contratoId: salvo.id } });
    await tx.contratoAprovador.createMany({ data: aprovadorIds.map((aprovadorId, ordem) => ({ contratoId: salvo.id, aprovadorId, ordem })) });
    return salvo;
  });
  return { id: c.id, sistemaDoClienteId, ...dados, aprovadorIds };
}

/** Contratos que citam o aprovador (para a tela de aprovadores). */
export async function contratosDoAprovador(aprovadorId: string): Promise<ContratoDetalhado[]> {
  return detalhar(await reports.contrato.findMany({ where: { aprovadores: { some: { aprovadorId } } }, include: INCLUIR }));
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
  const ativos = (await detalhar(await reports.contrato.findMany({ where: { ativo: true }, include: INCLUIR }))).filter((c) => c.clienteAtivo);
  if (!ativos.length) return [];
  const clienteIds = [...new Set(ativos.map((c) => c.clienteId))];
  const estabelecimentos = await reports.estabelecimento.findMany({
    where: { clienteId: { in: clienteIds.map((id) => idPlataforma(id)!) } },
    include: { setores: { orderBy: { nome: "asc" } } },
    orderBy: { nome: "asc" },
  });
  const resultado: ClienteCheckin[] = [];
  for (const id of clienteIds) {
    const contratos = ativos.filter((c) => c.clienteId === id);
    const unidades = estabelecimentos.filter((u) => idTexto(u.clienteId) === id);
    if (!unidades.length) continue;
    resultado.push({
      id,
      nome: contratos[0].clienteNome,
      contratos: contratos.map((x) => ({ id: x.id, sistemaNome: x.sistemaNome })),
      unidades: unidades.map((u) => ({ id: u.id, nome: u.nome, endereco: u.endereco, setores: u.setores.map((s) => ({ id: s.id, nome: s.nome })) })),
    });
  }
  return resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
