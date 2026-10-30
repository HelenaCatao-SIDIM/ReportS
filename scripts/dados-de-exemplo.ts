/*
 * Dados de exemplo para desenvolvimento: amostra da CBO, temas, aprovadores e, para os clientes que já existem no
 * banco plataforma de desenvolvimento, estabelecimentos, setores e contratos. Só roda fora de produção e com o banco
 * do ReportS vazio. Clientes, sistemas do cliente, participantes e usuários vêm do SINC de desenvolvimento.
 *
 * Uso: npm run db:exemplo
 */
import { plataforma, reports, rodar } from "./lib/bancos";

// Amostra para testar a busca; os códigos não foram conferidos com a tabela oficial (use npm run cbo:importar).
const CBO: [string, string][] = [
  ["411005", "Auxiliar de escritório"], ["411010", "Assistente administrativo"], ["410105", "Supervisor administrativo"],
  ["142105", "Gerente administrativo"], ["422105", "Recepcionista, em geral"], ["252210", "Contador"],
  ["252405", "Analista de recursos humanos"], ["212405", "Analista de desenvolvimento de sistemas"], ["414105", "Almoxarife"],
  ["223505", "Enfermeiro"], ["322205", "Técnico de enfermagem"], ["225125", "Médico clínico"], ["223405", "Farmacêutico"],
  ["251605", "Assistente social"], ["515105", "Agente comunitário de saúde"],
];

const TEMAS: [string, string, string][] = [
  ["Cadastro de contribuintes", "serp", "Cadastros"], ["Emissão de guias de IPTU", "serp", "Arrecadação"],
  ["Baixa de pagamentos", "serp", "Arrecadação"], ["Folha de pagamento mensal", "sca", "Folha"], ["Cálculo de férias", "sca", "Folha"],
  ["Ponto eletrônico", "sca", "Frequência"], ["Agendamento de consultas", "saude", "Recepção"],
  ["Dispensação de medicamentos", "saude", "Farmácia"], ["Cadastros básicos", "se", "Cadastros"], ["Emissão de relatórios", "se", "Relatórios"],
];

const id = () => crypto.randomUUID();

rodar(async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Dados de exemplo não rodam em produção.");
  if ((await reports.contrato.count()) || (await reports.estabelecimento.count())) throw new Error("O banco do ReportS já tem dados; nada foi feito.");

  if (!(await reports.cbo.count())) await reports.cbo.createMany({ data: CBO.map(([codigo, titulo]) => ({ codigo, titulo })) });
  const sistemas = new Set((await plataforma.erp_systems.findMany({ select: { codigo: true } })).map((s) => s.codigo));
  await reports.tema.createMany({ data: TEMAS.filter(([, s]) => sistemas.has(s)).map(([nome, sistema, modulo]) => ({ id: id(), nome, sistema, modulo })) });

  const aprovadores = [
    { id: id(), nome: "Marta Ribeiro", cargo: "Secretária de Administração", email: "marta.ribeiro@cliente.example" },
    { id: id(), nome: "José Antunes", cargo: "Diretor de TI", email: "jose.antunes@cliente.example" },
  ];
  await reports.aprovador.createMany({ data: aprovadores });

  const clientes = await plataforma.customers.findMany({
    where: { ativo: true },
    include: { clients: { where: { estado: { in: ["em_implantacao", "vinculado"] } } } },
    orderBy: { id: "asc" },
    take: 5,
  });
  let contratos = 0;
  for (const c of clientes) {
    await reports.estabelecimento.create({
      data: {
        id: id(),
        clienteId: c.id,
        nome: "Sede",
        endereco: "Praça Central, 100 — Centro",
        latitude: -22.9035,
        longitude: -47.0621,
        raioMetros: 50,
        setores: { create: ["Protocolo", "Recursos Humanos", "Tributação"].map((nome) => ({ id: id(), nome })) },
      },
    });
    for (const s of c.clients) {
      await reports.contrato.create({
        data: {
          id: id(),
          clienteId: c.id,
          sistemaDoClienteId: s.id,
          texto: `Contrato de suporte e treinamento — ${s.sistema.toUpperCase()}`,
          nivel: contratos % 2 ? "nominal" : "assinado",
          exigeCpf: contratos % 2 === 0,
          aprovadores: { create: aprovadores.map((a, ordem) => ({ aprovadorId: a.id, ordem })) },
        },
      });
      contratos++;
    }
  }
  console.log(`Dados de exemplo: ${CBO.length} ocupações, ${TEMAS.length} temas, ${aprovadores.length} aprovadores, ${clientes.length} cliente(s) com estabelecimento e ${contratos} contrato(s).`);
});
