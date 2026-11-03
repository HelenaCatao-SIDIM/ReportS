/*
 * Ambiente de teste no seu computador, SEM o SINC: cria a estrutura do banco `plataforma` e dados de exemplo
 * (sistemas, clientes, participantes, usuários e papéis) num PostgreSQL vazio. Serve só para rodar e analisar o
 * ReportS na sua máquina; a estrutura verdadeira da plataforma é do SINC (D-03) e nunca é criada por aqui.
 *
 * Trava de segurança: só roda se o banco é do próprio computador, não tem "prod" no nome e não tem nenhuma tabela
 * (o banco do SINC tem). Para recomeçar, apague o banco e crie de novo.
 *
 * Uso: npm run db:ambiente-teste
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import bcrypt from "bcryptjs";
import { CATALOGO, PERMISSOES } from "../src/lib/permissoes";
import { plataforma, rodar } from "./lib/bancos";

const SENHA = "sidim123";
const LOCAIS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Estrutura das tabelas da plataforma que o ReportS lê, gerada do schema do Prisma (sempre igual ao código). */
function estruturaDaPlataforma(): string[] {
  const prisma = createRequire(import.meta.url).resolve("prisma/build/index.js");
  const saida = execFileSync(
    process.execPath,
    [prisma, "migrate", "diff", "--from-empty", "--to-schema", "prisma/plataforma/schema.prisma", "--script", "--config", "prisma.plataforma.config.ts"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return saida
    .split(/;\s*\n/)
    .map((c) =>
      c
        .split("\n")
        .filter((l) => !l.trim().startsWith("--") && !l.startsWith("Loaded Prisma config"))
        .join("\n")
        .trim(),
    )
    .filter((c) => /^CREATE /i.test(c));
}

rodar(async () => {
  if (process.env.NODE_ENV === "production") throw new Error("O ambiente de teste não roda em produção.");
  const alvo = new URL(process.env.PLATAFORMA_DATABASE_URL ?? "");
  const banco = decodeURIComponent(alvo.pathname.replace(/^\//, ""));
  if (!LOCAIS.has(alvo.hostname)) throw new Error(`Recusado: o banco plataforma está em "${alvo.hostname}". Este script só cria o ambiente de teste num PostgreSQL do próprio computador.`);
  if (/prod/i.test(banco)) throw new Error(`Recusado: "${banco}" parece um banco de produção.`);
  const [{ n }] = await plataforma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM information_schema.tables WHERE table_schema = 'public'`;
  if (Number(n) > 0) throw new Error(`Recusado: o banco "${banco}" já tem ${n} tabela(s), então não é um banco de teste vazio. Para recomeçar, apague-o e crie de novo.`);

  const comandos = estruturaDaPlataforma();
  if (comandos.length < 9) throw new Error("Não consegui gerar a estrutura da plataforma a partir do schema do Prisma.");
  for (const c of comandos) await plataforma.$executeRawUnsafe(c);

  // Sistemas do ReportS e o catálogo de permissões (o mesmo que o deploy registra).
  await plataforma.erp_systems.createMany({
    data: [
      { codigo: "serp", nome: "SERP", posicao: 1 },
      { codigo: "sca", nome: "SCA", posicao: 2 },
      { codigo: "se", nome: "SE", posicao: 3 },
      { codigo: "saude", nome: "Saúde", posicao: 4 },
    ],
  });
  await plataforma.permissions.createMany({ data: CATALOGO.map((p) => ({ codigo: p.codigo, produto: "reports", grupo: p.grupo, descricao: p.descricao })) });

  // Clientes, sistemas do cliente e participantes confirmados (vêm sem CPF e sem CBO, como do painel do SINC).
  const prefeitura = await plataforma.customers.create({ data: { nome: "Prefeitura de Vale Verde", cnpj: "11444777000161" } });
  const clinica = await plataforma.customers.create({ data: { nome: "Clínica Bem Viver", cnpj: "34238864000168" } });
  const serp = await plataforma.clients.create({ data: { customer_id: prefeitura.id, sistema: "serp", tenant_id: "teste-serp-1", estado: "vinculado" } });
  const sca = await plataforma.clients.create({ data: { customer_id: prefeitura.id, sistema: "sca", tenant_id: "teste-sca-1", estado: "vinculado" } });
  const saude = await plataforma.clients.create({ data: { customer_id: clinica.id, sistema: "saude", estado: "em_implantacao" } });
  await plataforma.client_users.createMany({
    data: [
      { client_id: serp.id, external_user_id: "1021", nome: "Luciana Ferraz", cargo: "Assistente administrativo" },
      { client_id: serp.id, external_user_id: "1034", nome: "Rogério Batista", cargo: "Assistente administrativo" },
      { client_id: sca.id, external_user_id: "2005", nome: "Patrícia Gomes", cargo: "Analista de RH" },
      { client_id: saude.id, external_user_id: "3001", nome: "Fábio Nunes", cargo: "Auxiliar de escritório" },
    ],
  });

  // Usuários e papéis. O Administrador é protegido: tem todas as permissões.
  const digest = bcrypt.hashSync(SENHA, 10);
  const contas = [
    { email: "admin@teste.local", nome: "Admin Teste", papel: "Administrador" },
    { email: "coord@teste.local", nome: "Coordenação Teste", papel: "Coordenação (só visitas)" },
    { email: "tecnico@teste.local", nome: "Técnico Teste", papel: "Técnico de campo" },
  ];
  const administrador = await plataforma.roles.create({ data: { nome: "Administrador", descricao: "Todas as permissões", protegido: true } });
  const coordenacao = await plataforma.roles.create({ data: { nome: "Coordenação (só visitas)", descricao: "Vê visitas e o cronograma" } });
  const tecnico = await plataforma.roles.create({ data: { nome: "Técnico de campo", descricao: "Só o App do Técnico" } });
  const permissao = async (codigo: string) => (await plataforma.permissions.findUniqueOrThrow({ where: { codigo } })).id;
  await plataforma.role_permissions.createMany({
    data: [
      { role_id: coordenacao.id, permission_id: await permissao(PERMISSOES.visitasGerenciar) },
      { role_id: tecnico.id, permission_id: await permissao(PERMISSOES.tecnico) },
    ],
  });
  const papel = new Map([
    ["Administrador", administrador.id],
    ["Coordenação (só visitas)", coordenacao.id],
    ["Técnico de campo", tecnico.id],
  ]);
  for (const c of contas) {
    const u = await plataforma.users.create({ data: { email_address: c.email, password_digest: digest, nome: c.nome } });
    await plataforma.user_roles.create({ data: { user_id: u.id, role_id: papel.get(c.papel)! } });
  }

  console.log(`Ambiente de teste criado no banco "${banco}": ${comandos.filter((c) => /^CREATE TABLE/i.test(c)).length} tabelas, 4 sistemas, 2 clientes e 3 usuários.`);
  console.log(`Entre com uma das contas (senha ${SENHA}):`);
  for (const c of contas) console.log(`  ${c.email.padEnd(22)} ${c.papel}`);
  console.log("Próximo passo: npm run db:exemplo");
});
