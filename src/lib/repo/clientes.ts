import "server-only";
import { idPlataforma, idTexto, plataforma, reports } from "@/lib/db";
import { normalizar } from "@/lib/format";
import type { Cliente, EstadoSistemaCliente, SistemaDoCliente, Setor, Unidade } from "@/lib/types";
import { buscarSistema, listarSistemas, nomesDosSistemas } from "./sistemas";

/*
 * Clientes e sistemas do cliente: tabelas `customers` e `clients` da plataforma (o cadastro comum com o SINC).
 * Estabelecimentos e setores: banco do ReportS, ligados ao cliente pelo id da plataforma.
 *
 * O usuário de banco do ReportS só grava as colunas que são dele (ADR-035 do SINC). As inclusões na plataforma são
 * feitas em SQL direto porque o Prisma mandaria também as colunas com valor padrão (datas, situação do ClickUp), que
 * o ReportS não pode gravar.
 */

/** O ReportS só enxerga os sistemas do cliente ligados a um cliente: em implantação ou vinculados (RN-PL-20). */
const VISIVEL = { estado: { in: ["em_implantacao", "vinculado"] } };

const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");

type LinhaCliente = {
  id: bigint;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  origem: string;
  fortics_nomes: unknown;
  clickup_cliente_option_id: string | null;
};

const SELECAO_CLIENTE = { id: true, nome: true, cnpj: true, ativo: true, origem: true, fortics_nomes: true, clickup_cliente_option_id: true } as const;

const paraCliente = (c: LinhaCliente): Cliente => ({
  id: idTexto(c.id),
  nome: c.nome,
  cnpj: c.cnpj ?? "",
  ativo: c.ativo,
  origem: c.origem === "manual" ? "manual" : "sinc",
  nomesFortics: Array.isArray(c.fortics_nomes) ? c.fortics_nomes.map(String) : [],
  nomeDoClickUp: !!c.clickup_cliente_option_id,
});

type LinhaSistemaDoCliente = { id: bigint; customer_id: bigint | null; sistema: string; tenant_id: string | null; estado: string };

const paraSistemaDoCliente = (x: LinhaSistemaDoCliente): SistemaDoCliente => ({
  id: idTexto(x.id),
  clienteId: x.customer_id === null ? "" : idTexto(x.customer_id),
  sistema: x.sistema,
  tenantId: x.tenant_id,
  estado: x.estado as EstadoSistemaCliente,
});

// ---------- Clientes ----------

export interface ClienteResumo extends Cliente {
  totalUnidades: number;
  /** Sistemas do cliente, na ordem do cadastro de sistemas. */
  sistemas: (SistemaDoCliente & { sistemaNome: string })[];
}

/** Ordena os sistemas do cliente pela ordem do cadastro de sistemas e põe o nome. */
async function comNomesDeSistema(lista: SistemaDoCliente[]) {
  const [nomeDe, todos] = await Promise.all([nomesDosSistemas(), listarSistemas({ incluirInativos: true })]);
  const posicao = new Map(todos.map((s) => [s.codigo, s.ordem]));
  const ordem = (codigo: string) => posicao.get(codigo) ?? Number.MAX_SAFE_INTEGER;
  return lista.sort((a, b) => ordem(a.sistema) - ordem(b.sistema)).map((x) => ({ ...x, sistemaNome: nomeDe(x.sistema) }));
}

/** Busca no nome (sem acento) ou no CNPJ (a partir de 3 dígitos). A lista de clientes é pequena: filtra aqui. */
export async function listarClientes(busca = ""): Promise<ClienteResumo[]> {
  const b = normalizar(busca);
  const digitos = busca.replace(/\D/g, "");
  const [linhas, contagem] = await Promise.all([
    plataforma.customers.findMany({
      select: { ...SELECAO_CLIENTE, clients: { where: VISIVEL, select: { id: true, customer_id: true, sistema: true, tenant_id: true, estado: true } } },
    }),
    reports.estabelecimento.groupBy({ by: ["clienteId"], _count: { _all: true } }),
  ]);
  const unidades = new Map(contagem.map((x) => [idTexto(x.clienteId), x._count._all]));
  const achados = linhas
    .map((l) => ({ cliente: paraCliente(l), sistemas: l.clients.map(paraSistemaDoCliente) }))
    .filter(({ cliente: c }) => !b || normalizar(c.nome).includes(b) || (digitos.length >= 3 && c.cnpj.includes(digitos)))
    .sort((x, y) => porNome(x.cliente, y.cliente));
  return Promise.all(
    achados.map(async ({ cliente, sistemas }) => ({ ...cliente, totalUnidades: unidades.get(cliente.id) ?? 0, sistemas: await comNomesDeSistema(sistemas) })),
  );
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  const chave = idPlataforma(id);
  if (chave === null) return null;
  const c = await plataforma.customers.findUnique({ where: { id: chave }, select: SELECAO_CLIENTE });
  return c ? paraCliente(c) : null;
}

/** Nomes dos clientes pelos ids (para listas), numa consulta só. */
export async function nomesDosClientes(ids: string[]): Promise<Map<string, string>> {
  const chaves = [...new Set(ids)].map(idPlataforma).filter((x): x is bigint => x !== null);
  if (!chaves.length) return new Map();
  const linhas = await plataforma.customers.findMany({ where: { id: { in: chaves } }, select: { id: true, nome: true } });
  return new Map(linhas.map((c) => [idTexto(c.id), c.nome]));
}

export async function cnpjEmUso(cnpj: string, excetoId?: string) {
  if (!cnpj) return false;
  const outro = await plataforma.customers.findFirst({ where: { cnpj, NOT: { id: idPlataforma(excetoId) ?? BigInt(-1) } }, select: { id: true } });
  return !!outro;
}

export type DadosCliente = Pick<Cliente, "nome" | "cnpj" | "ativo" | "nomesFortics">;

/**
 * Cria o cliente à mão (implantação) com os sistemas informados em implantação, numa transação da plataforma.
 * Ordem das gravações entre os bancos: cliente e sistemas do cliente (plataforma), depois o contrato (ReportS).
 */
export async function criarCliente(dados: DadosCliente, sistemas: string[], criadoPor: string): Promise<Cliente> {
  const ativos = await Promise.all([...new Set(sistemas)].map(buscarSistema));
  if (ativos.some((s) => !s?.ativo)) throw new Error("Sistema inválido ou desativado");
  const id = await plataforma.$transaction(async (tx) => {
    const [c] = await tx.$queryRaw<{ id: bigint }[]>`
      INSERT INTO customers (nome, cnpj, fortics_nomes, origem, criado_por_user_id)
      VALUES (${dados.nome}, ${dados.cnpj || null}, ${JSON.stringify(dados.nomesFortics)}::jsonb, 'manual', ${idPlataforma(criadoPor)})
      RETURNING id`;
    for (const s of ativos) {
      await tx.$executeRaw`INSERT INTO clients (customer_id, sistema, estado) VALUES (${c.id}, ${s!.codigo}, 'em_implantacao')`;
    }
    return c.id;
  });
  return (await buscarCliente(idTexto(id)))!;
}

/**
 * Atualiza os dados do cliente. Com vínculo no ClickUp o nome é o da opção e acompanha o ClickUp (RN-PL-12):
 * o nome enviado é ignorado.
 */
export async function atualizarCliente(id: string, dados: DadosCliente): Promise<void> {
  const chave = idPlataforma(id);
  const atual = chave === null ? null : await plataforma.customers.findUnique({ where: { id: chave }, select: { clickup_cliente_option_id: true } });
  if (!atual) throw new Error("Cliente não encontrado");
  await plataforma.customers.update({
    where: { id: chave! },
    data: {
      ...(atual.clickup_cliente_option_id ? {} : { nome: dados.nome }),
      cnpj: dados.cnpj || null,
      ativo: dados.ativo,
      fortics_nomes: dados.nomesFortics,
      updated_at: new Date(),
    },
  });
}

// ---------- Sistemas do cliente ----------

/** Sistemas do cliente com o nome do sistema, na ordem do cadastro de sistemas. */
export async function listarSistemasDoCliente(clienteId: string): Promise<(SistemaDoCliente & { sistemaNome: string })[]> {
  const chave = idPlataforma(clienteId);
  if (chave === null) return [];
  const linhas = await plataforma.clients.findMany({ where: { customer_id: chave, ...VISIVEL } });
  return comNomesDeSistema(linhas.map(paraSistemaDoCliente));
}

export async function buscarSistemaDoCliente(id: string): Promise<(SistemaDoCliente & { sistemaNome: string }) | null> {
  const chave = idPlataforma(id);
  if (chave === null) return null;
  const x = await plataforma.clients.findFirst({ where: { id: chave, customer_id: { not: null }, ...VISIVEL } });
  if (!x) return null;
  return { ...paraSistemaDoCliente(x), sistemaNome: (await nomesDosSistemas())(x.sistema) };
}

/** Um cliente tem no máximo um registro por sistema (RN-PL-27). */
export async function clienteTemSistema(clienteId: string, codigo: string) {
  const chave = idPlataforma(clienteId);
  if (chave === null) return false;
  return !!(await plataforma.clients.findFirst({ where: { customer_id: chave, sistema: codigo, estado: { not: "unido" } }, select: { id: true } }));
}

/** Acrescenta um sistema "em implantação" ao cliente. A ligação com o tenant é feita no SINC. */
export async function adicionarSistemaAoCliente(clienteId: string, codigo: string): Promise<void> {
  const sistema = await buscarSistema(codigo);
  if (!sistema?.ativo) throw new Error("Sistema inválido ou desativado");
  if (await clienteTemSistema(clienteId, codigo)) throw new Error("O cliente já tem este sistema");
  await plataforma.$executeRaw`INSERT INTO clients (customer_id, sistema, estado) VALUES (${idPlataforma(clienteId)}, ${codigo}, 'em_implantacao')`;
}

// ---------- Estabelecimentos ----------

export interface UnidadeComSetores extends Unidade {
  setores: Setor[];
}

type LinhaUnidade = Awaited<ReturnType<typeof reports.estabelecimento.findFirstOrThrow>>;

const paraUnidade = (u: LinhaUnidade): Unidade => ({
  id: u.id,
  clienteId: idTexto(u.clienteId),
  nome: u.nome,
  endereco: u.endereco,
  latitude: u.latitude,
  longitude: u.longitude,
  raioMetros: u.raioMetros,
});

const paraSetor = (s: { id: string; estabelecimentoId: string; nome: string }): Setor => ({ id: s.id, unidadeId: s.estabelecimentoId, nome: s.nome });

export async function listarUnidades(clienteId: string): Promise<UnidadeComSetores[]> {
  const chave = idPlataforma(clienteId);
  if (chave === null) return [];
  const linhas = await reports.estabelecimento.findMany({ where: { clienteId: chave }, include: { setores: true } });
  return linhas.map((u) => ({ ...paraUnidade(u), setores: u.setores.map(paraSetor).sort(porNome) })).sort(porNome);
}

export async function buscarUnidade(id: string): Promise<Unidade | null> {
  const u = await reports.estabelecimento.findUnique({ where: { id } });
  return u ? paraUnidade(u) : null;
}

export type DadosUnidade = Omit<Unidade, "id" | "clienteId">;

export async function criarUnidade(clienteId: string, dados: DadosUnidade): Promise<Unidade> {
  const chave = idPlataforma(clienteId);
  if (chave === null) throw new Error("Cliente não encontrado");
  return paraUnidade(await reports.estabelecimento.create({ data: { ...dados, id: crypto.randomUUID(), clienteId: chave } }));
}

export async function atualizarUnidade(id: string, dados: DadosUnidade): Promise<void> {
  await reports.estabelecimento.updateMany({ where: { id }, data: dados });
}

/** Estabelecimento ou setor com visita registrada não pode ser removido: a visita aponta para ele. */
export class EmUsoError extends Error {}

/** Remove o estabelecimento e os seus setores, se nenhuma visita aponta para eles. */
export async function removerUnidade(id: string): Promise<void> {
  if (await reports.visita.count({ where: { estabelecimentoId: id } })) {
    throw new EmUsoError("Este estabelecimento tem visitas registradas e não pode ser removido.");
  }
  await reports.estabelecimento.deleteMany({ where: { id } });
}

// ---------- Setores ----------

export async function buscarSetor(id: string): Promise<Setor | null> {
  const s = await reports.setor.findUnique({ where: { id } });
  return s ? paraSetor(s) : null;
}

export async function setorDuplicado(unidadeId: string, nome: string, excetoId?: string) {
  const n = normalizar(nome);
  const setores = await reports.setor.findMany({ where: { estabelecimentoId: unidadeId }, select: { id: true, nome: true } });
  return setores.some((s) => normalizar(s.nome) === n && s.id !== excetoId);
}

export async function criarSetor(unidadeId: string, nome: string): Promise<Setor> {
  return paraSetor(await reports.setor.create({ data: { id: crypto.randomUUID(), estabelecimentoId: unidadeId, nome } }));
}

export async function renomearSetor(id: string, nome: string): Promise<void> {
  await reports.setor.updateMany({ where: { id }, data: { nome } });
}

/** Setor com visita registrada não pode ser removido. */
export async function removerSetor(id: string): Promise<void> {
  if (await reports.visita.count({ where: { setorId: id } })) {
    throw new EmUsoError("Este setor tem visitas registradas e não pode ser removido.");
  }
  await reports.setor.deleteMany({ where: { id } });
}
