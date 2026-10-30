/*
 * Testes de integração com o banco. Usam um banco do ReportS só para testes (REPORTS_TEST_DATABASE_URL), que é
 * migrado e esvaziado aqui, e o banco plataforma de desenvolvimento (PLATAFORMA_DATABASE_URL), só para leitura:
 * pegam um sistema do cliente e um usuário que já existem. Sem REPORTS_TEST_DATABASE_URL, são pulados.
 *
 *   createdb -O reports reports_test
 *   REPORTS_TEST_DATABASE_URL=postgresql://reports:...@localhost:5432/reports_test npm test
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, before, beforeEach, describe, test } from "node:test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const URL_TESTE = process.env.REPORTS_TEST_DATABASE_URL;

describe("banco", { skip: !URL_TESTE && "defina REPORTS_TEST_DATABASE_URL" }, () => {
  // Carregados depois de apontar o banco do ReportS para o de testes.
  let db: typeof import("@/lib/db");
  let visitas: typeof import("@/lib/repo/visitas");
  let relatorios: typeof import("@/lib/repo/relatorios");
  let contratos: typeof import("@/lib/repo/contratos");
  let aprovadores: typeof import("@/lib/repo/aprovadores");
  let tecnico: { id: string; nome: string; email: string; ativo: boolean; telefone: null; papelIds: string[] };
  let sistemaDoClienteId: string;
  let clienteId: string;
  let contratoId: string;
  let estabelecimentoId: string;

  before(async () => {
    if (!/_test\b|test/.test(URL_TESTE!)) throw new Error("REPORTS_TEST_DATABASE_URL precisa ser um banco de testes (o nome deve ter 'test')");
    process.env.REPORTS_DATABASE_URL = URL_TESTE;
    execFileSync("npx", ["prisma", "migrate", "deploy", "--config", "prisma.reports.config.ts"], { stdio: "ignore", env: process.env });
    db = await import("@/lib/db");
    visitas = await import("@/lib/repo/visitas");
    relatorios = await import("@/lib/repo/relatorios");
    contratos = await import("@/lib/repo/contratos");
    aprovadores = await import("@/lib/repo/aprovadores");

    const sdc = await db.plataforma.clients.findFirst({ where: { customer_id: { not: null }, estado: { in: ["em_implantacao", "vinculado"] } } });
    const usuario = await db.plataforma.users.findFirst({ where: { active: true } });
    assert.ok(sdc && usuario, "o banco plataforma de desenvolvimento precisa ter um sistema do cliente ligado e um usuário ativo");
    sistemaDoClienteId = String(sdc.id);
    clienteId = String(sdc.customer_id);
    tecnico = { id: String(usuario.id), nome: usuario.nome ?? usuario.email_address, email: usuario.email_address, ativo: true, telefone: null, papelIds: [] };
  });

  beforeEach(async () => {
    const tabelas = await db.reports.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await db.reports.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
    const a = await aprovadores.criarAprovador({ nome: "Marta", cargo: "Secretária", email: "Marta@Cliente.example" });
    const b = await aprovadores.criarAprovador({ nome: "José", cargo: "Diretor", email: "jose@cliente.example" });
    contratoId = (await contratos.salvarContrato(sistemaDoClienteId, { texto: "Contrato", nivel: "nominal", exigeCpf: false, ativo: true, aprovadorIds: [b.id, a.id] })).id;
    estabelecimentoId = crypto.randomUUID();
    await db.reports.estabelecimento.create({ data: { id: estabelecimentoId, clienteId: BigInt(clienteId), nome: "Sede", raioMetros: 50 } });
  });

  after(async () => {
    await Promise.all([db?.reports.$disconnect(), db?.plataforma.$disconnect()]);
  });

  const checkin = () =>
    visitas.abrirVisita({
      tecnicoId: tecnico.id, clienteId, contratoId, unidadeId: estabelecimentoId, setorId: null, setorOutro: "Gabinete", tipo: "reuniao",
      checkin: { latitude: -22.9, longitude: -47.06 }, meio: "celular", distanciaCheckinM: 10, raioCheckinM: 50,
      fotoAmbiente: { id: "f1", url: "/arquivos/f1" }, printTela: null, linkReuniao: null,
    });

  const encerrar = (id: string) => visitas.encerrarPeloTecnico(id, tecnico.id, { checkout: null, observacoes: "ok", pendencias: "", proximosPassos: "" });

  test("contrato guarda os aprovadores na ordem marcada e o e-mail em minúsculas", async () => {
    const c = await contratos.buscarContrato(contratoId);
    assert.deepEqual(c?.aprovadores.map((a) => a.nome), ["José", "Marta"]);
    assert.equal(c?.aprovadores[1].email, "marta@cliente.example");
    assert.equal(c?.sistemaDoClienteId, sistemaDoClienteId);
  });

  test("uma visita em andamento por técnico, também quando o banco é chamado direto", async () => {
    const v = await checkin();
    await assert.rejects(checkin(), /já tem uma visita em andamento/);
    // Dois check-ins ao mesmo tempo passariam pela conferência do código; o índice único parcial recusa.
    await assert.rejects(
      db.reports.visita.create({
        data: { id: crypto.randomUUID(), tecnicoId: BigInt(tecnico.id), clienteId: BigInt(clienteId), contratoId, estabelecimentoId, tipo: "reuniao", status: "em_andamento", entrada: new Date(), meio: "celular" },
      }),
    );
    await encerrar(v.id);
    await checkin();
  });

  test("fotos extras enviadas ao mesmo tempo não se perdem", async () => {
    const v = await checkin();
    await Promise.all([1, 2, 3].map((n) => visitas.adicionarFotoExtra(v.id, tecnico.id, { id: `x${n}`, url: `/arquivos/x${n}` })));
    await visitas.removerFotoExtra(v.id, tecnico.id, "x2");
    const fotos = (await visitas.buscarVisita(v.id))!.fotosExtras.map((f) => f.id).sort();
    assert.deepEqual(fotos, ["x1", "x3"]);
  });

  test("o CEP é gravado dentro do local, sem mexer na coordenada, e sai da lista de pendentes", async () => {
    const v = await checkin();
    assert.equal((await visitas.locaisSemCep(10)).length, 1);
    await visitas.definirEndereco(v.id, "checkin", {
      status: "ok", cep: "87020000", aproximado: true, logradouro: null, bairro: null, cidade: "Maringá", uf: "PR", fonte: "nominatim", atualizadoEm: new Date().toISOString(),
    });
    const lida = await visitas.buscarVisita(v.id);
    assert.equal(lida?.checkin?.latitude, -22.9);
    assert.equal(lida?.checkin?.endereco?.cep, "87020000");
    assert.equal((await visitas.locaisSemCep(10)).length, 0);
  });

  test("relatório: rascunho, emissão, primeira decisão vale e as visitas travam", async () => {
    const v = await checkin();
    await encerrar(v.id);
    const hoje = new Date().toISOString().slice(0, 10);
    const criado = await relatorios.criarRascunho(contratoId, "2000-01-01", hoje);
    assert.ok("relatorio" in criado);
    const r = criado.relatorio;
    assert.deepEqual(r.visitaIds, [v.id]);
    assert.ok("erro" in (await relatorios.criarRascunho(contratoId, hoje, hoje)), "período sobreposto é recusado");

    const conteudo = relatorios.congelar((await relatorios.montarConteudo(r.id))!);
    const { versao, links } = await relatorios.registrarEmissao(r.id, { conteudo, pdfUrl: "/arquivos/pdf", pdfTamanho: 10, emitidoEm: new Date().toISOString() });
    assert.equal(versao.numero, 1);
    assert.equal(links.length, 2);
    await assert.rejects(relatorios.registrarEmissao(r.id, { conteudo, pdfUrl: "/arquivos/pdf", pdfTamanho: 10, emitidoEm: new Date().toISOString() }));

    // Os dois aprovadores decidem ao mesmo tempo: só um vale.
    const [d1, d2] = await Promise.all([
      relatorios.registrarDecisao(links[0].token, "aprovado", null),
      relatorios.registrarDecisao(links[1].token, "ajuste", "Faltou um nome"),
    ]);
    assert.equal([d1, d2].filter((d) => d.ok).length, 1);
    const final = (await relatorios.buscarRelatorio(r.id))!;
    assert.ok(final.status === "aprovado" || final.status === "ajuste_solicitado");
    assert.ok(final.versoes[0].decisao);
    assert.equal((await relatorios.buscarPorLink(links[0].token))?.podeDecidir, false);

    if (final.status === "aprovado") {
      assert.equal((await visitas.buscarVisita(v.id))?.travada, true);
      await assert.rejects(
        visitas.corrigirPelaAdministracao(v.id, { ...(await visitas.buscarVisita(v.id))!, saida: new Date().toISOString(), removerPresencas: [], removerFotos: [], observacoes: "x" }, tecnico, "teste"),
        /relatório aprovado/,
      );
    }
  });

  test("excluir rascunho libera as visitas", async () => {
    const v = await checkin();
    await encerrar(v.id);
    const criado = await relatorios.criarRascunho(contratoId, "2000-01-01", new Date().toISOString().slice(0, 10));
    assert.ok("relatorio" in criado);
    await relatorios.excluirRascunho(criado.relatorio.id);
    assert.equal((await visitas.buscarVisita(v.id))?.relatorioId, null);
  });

  test("o banco recusa período invertido e código CBO fora do formato", async () => {
    await assert.rejects(db.reports.relatorio.create({ data: { id: "r", clienteId: BigInt(clienteId), contratoId, de: new Date("2026-10-31"), ate: new Date("2026-10-01"), status: "rascunho" } }));
    await assert.rejects(db.reports.cbo.create({ data: { codigo: "12-34", titulo: "x" } }));
  });
});
