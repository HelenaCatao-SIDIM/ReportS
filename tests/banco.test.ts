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
  let cronograma: typeof import("@/lib/repo/cronograma");
  let importacao: typeof import("@/lib/repo/importar-cronograma");
  let clientes: typeof import("@/lib/repo/clientes");
  let equipes: typeof import("@/lib/repo/equipes");
  let temas: typeof import("@/lib/repo/temas");
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
    cronograma = await import("@/lib/repo/cronograma");
    importacao = await import("@/lib/repo/importar-cronograma");
    clientes = await import("@/lib/repo/clientes");
    equipes = await import("@/lib/repo/equipes");
    temas = await import("@/lib/repo/temas");

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

  // ---------- Cronograma de implantação ----------

  const hojeLocal = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const treinoNo = async (setorId: string | null) => {
    const v = await visitas.abrirVisita({
      tecnicoId: tecnico.id, clienteId, contratoId, unidadeId: estabelecimentoId, setorId, setorOutro: null, tipo: "treinamento",
      checkin: { latitude: -22.9, longitude: -47.06 }, meio: "celular", distanciaCheckinM: 10, raioCheckinM: 50,
      fotoAmbiente: { id: "f1", url: "/arquivos/f1" }, printTela: null, linkReuniao: null,
    });
    return v;
  };

  test("cronograma: só a visita encerrada, do setor, do tipo e do estabelecimento do item cumpre", async () => {
    const setor = await db.reports.setor.create({ data: { id: crypto.randomUUID(), estabelecimentoId, nome: "Recepção" } });
    const outro = await db.reports.setor.create({ data: { id: crypto.randomUUID(), estabelecimentoId, nome: "Farmácia" } });
    const hoje = hojeLocal();
    const base = { contratoId, unidadeId: estabelecimentoId, tipo: "treinamento" as const, observacao: "" };
    await cronograma.criarItemCronograma({ ...base, setorId: setor.id, prazo: somarDias(hoje, 10) });
    await cronograma.criarItemCronograma({ ...base, setorId: outro.id, prazo: somarDias(hoje, -1) });
    await cronograma.criarItemCronograma({ ...base, setorId: null, tipo: "implantacao", prazo: somarDias(hoje, 3) });

    const situacao = async () => Object.fromEntries((await cronograma.listarCronograma(hoje, { contratoId })).map((i) => [`${i.setorNome ?? "todos"}/${i.tipo}`, i.situacao]));
    assert.deepEqual(await situacao(), { "Recepção/treinamento": "no_prazo", "Farmácia/treinamento": "atrasado", "todos/implantacao": "a_vencer" });

    // Em andamento não conta.
    const v = await treinoNo(setor.id);
    assert.equal((await situacao())["Recepção/treinamento"], "no_prazo");
    // Encerrada conta, só para o setor dela.
    await encerrar(v.id);
    assert.deepEqual(await situacao(), { "Recepção/treinamento": "cumprido", "Farmácia/treinamento": "atrasado", "todos/implantacao": "a_vencer" });

    // Visita cancelada não conta.
    const c = await treinoNo(outro.id);
    await visitas.cancelarPelaAdministracao(c.id, tecnico, "Check-in feito por engano");
    assert.equal((await situacao())["Farmácia/treinamento"], "atrasado");
    // Depois do prazo, cumpre com atraso.
    const d = await treinoNo(outro.id);
    await encerrar(d.id);
    assert.equal((await situacao())["Farmácia/treinamento"], "cumprido_com_atraso");

    const pendentes = await cronograma.listarPendentesDosContratos([contratoId], hoje);
    assert.deepEqual(pendentes.map((i) => i.tipo), ["implantacao"], "no check-in só aparece o que falta");
  });

  test("setores acrescentados à visita: sem repetir, até o check-out, e cumprem o item do cronograma", async () => {
    const recepcao = await db.reports.setor.create({ data: { id: crypto.randomUUID(), estabelecimentoId, nome: "Recepção" } });
    const farmacia = await db.reports.setor.create({ data: { id: crypto.randomUUID(), estabelecimentoId, nome: "Farmácia" } });
    const hoje = hojeLocal();
    const base = { contratoId, unidadeId: estabelecimentoId, tipo: "treinamento" as const, observacao: "", prazo: somarDias(hoje, 10) };
    await cronograma.criarItemCronograma({ ...base, setorId: recepcao.id });
    await cronograma.criarItemCronograma({ ...base, setorId: farmacia.id });
    const situacao = async () => Object.fromEntries((await cronograma.listarCronograma(hoje, { contratoId })).map((i) => [i.setorNome, i.situacao]));

    const v = await treinoNo(recepcao.id);
    assert.equal(await visitas.adicionarSetorExtra(v.id, tecnico.id, { setorId: recepcao.id }), "Este setor já está na visita.", "o do check-in não entra de novo");
    assert.equal(await visitas.adicionarSetorExtra(v.id, tecnico.id, { setorId: farmacia.id }), null);
    assert.equal(await visitas.adicionarSetorExtra(v.id, tecnico.id, { setorId: farmacia.id }), "Este setor já está na visita.", "nem o acrescentado duas vezes");
    assert.equal(await visitas.adicionarSetorExtra(v.id, tecnico.id, { setorOutro: "Almoxarifado" }), null);
    assert.equal(await visitas.adicionarSetorExtra(v.id, tecnico.id, { setorOutro: "  almoxarifado " }), "Este setor já está na visita.", "o digitado também não repete, sem diferenciar caixa");
    assert.equal(await visitas.adicionarSetorExtra(v.id, tecnico.id, { setorOutro: "farmacia" }), "Este setor já está na visita.", "digitar o nome de um setor que já está na visita (cadastrado) também não repete");

    const aberta = (await visitas.buscarVisita(v.id))!;
    assert.deepEqual((aberta.setoresExtras ?? []).map((s) => s.nome), ["Farmácia", "Almoxarifado"], "na ordem em que foram acrescentados");
    assert.equal((await situacao())["Farmácia"], "no_prazo", "em andamento não cumpre nada");

    // Outro técnico não mexe; depois do check-out ninguém acrescenta.
    await assert.rejects(visitas.adicionarSetorExtra(v.id, "999999999", { setorId: farmacia.id }), /não encontrada/);
    await visitas.removerSetorExtra(v.id, tecnico.id, (aberta.setoresExtras ?? [])[1].id);
    assert.deepEqual(((await visitas.buscarVisita(v.id))!.setoresExtras ?? []).map((s) => s.nome), ["Farmácia"], "o acrescentado pode ser retirado");
    await encerrar(v.id);
    assert.deepEqual(await situacao(), { Recepção: "cumprido", Farmácia: "cumprido" }, "uma visita com os dois setores cumpre os dois itens");
    await assert.rejects(visitas.adicionarSetorExtra(v.id, tecnico.id, { setorId: farmacia.id }), /encerrada/);

    // O setor acrescentado conta como "com visita": não pode ser removido.
    await assert.rejects(clientes.removerSetor(farmacia.id), /visitas registradas/);

    // A administração move a visita para outro estabelecimento: os setores acrescentados (do anterior) saem, e fica no histórico.
    const outra = await db.reports.estabelecimento.create({ data: { id: crypto.randomUUID(), clienteId: BigInt(clienteId), nome: "Anexo", raioMetros: 50 } });
    const antes = (await visitas.buscarVisita(v.id))!;
    const mudancas = await visitas.corrigirPelaAdministracao(v.id, { ...antes, unidadeId: outra.id, setorId: null, setorOutro: "Gabinete", saida: antes.saida!, removerPresencas: [], removerFotos: [] }, tecnico, "estabelecimento errado");
    assert.ok(mudancas.some((m) => m.campo === "Setores acrescentados" && /Farmácia/.test(m.antes)), "o histórico diz quais setores saíram");
    assert.deepEqual((await visitas.buscarVisita(v.id))!.setoresExtras, []);
  });

  test("a presença guarda como foi validada: login no Saúde, sem login (técnico) ou nada (login não exigido)", async () => {
    const v = await checkin();
    const pessoa = (id: string, nome: string, validacao?: "login_saude" | "sem_login" | null) => ({
      participanteId: id, estado: "confirmado" as const, nome, cbo: null, setor: "", cpf: null, confirmacao: "nominal" as const, assinatura: null, validacao,
    });
    await visitas.adicionarPresenca(v.id, tecnico.id, pessoa("101", "Com login", "login_saude"));
    await visitas.adicionarPresenca(v.id, tecnico.id, pessoa("102", "Sem login", "sem_login"));
    await visitas.adicionarPresenca(v.id, tecnico.id, pessoa("103", "Login não exigido"));
    const lista = (await visitas.buscarVisita(v.id))!.presencas;
    assert.deepEqual(lista.map((p) => [p.nome, p.validacao]), [["Com login", "login_saude"], ["Sem login", "sem_login"], ["Login não exigido", null]]);
  });

  test("cronograma: duplicado, cancelar, e o relatório recebe o cronograma sem a observação interna", async () => {
    const hoje = hojeLocal();
    const d = { contratoId, unidadeId: estabelecimentoId, setorId: null, tipo: "treinamento" as const, prazo: somarDias(hoje, 20), observacao: "Combinado por telefone com o prefeito" };
    assert.equal(await cronograma.itemCronogramaDuplicado(d), false);
    await cronograma.criarItemCronograma(d);
    assert.equal(await cronograma.itemCronogramaDuplicado(d), true);

    const [item] = await cronograma.listarCronograma(hoje, { contratoId });
    await cronograma.atualizarItemCronograma(item.id, { unidadeId: estabelecimentoId, setorId: null, tipo: "treinamento", prazo: somarDias(hoje, 30), observacao: "Novo prazo" });
    assert.equal((await cronograma.buscarItemCronograma(item.id))?.prazo, somarDias(hoje, 30));

    const congelado = await cronograma.congelarCronograma(contratoId, hoje);
    assert.equal(congelado?.itens.length, 1);
    assert.equal(congelado?.em, hoje);
    assert.ok(!JSON.stringify(congelado).includes("Novo prazo"), "a observação interna não vai para o cliente");

    await cronograma.definirItemCronogramaCancelado(item.id, true);
    assert.equal(await cronograma.itemCronogramaDuplicado(d), false, "item cancelado não conta como duplicado");
    assert.equal(await cronograma.congelarCronograma(contratoId, hoje), null, "sem itens ativos, o relatório não mostra cronograma");
    await cronograma.definirItemCronogramaCancelado(item.id, false);
  });

  test("cronograma: item ativo impede remover setor e estabelecimento; o cancelado sai junto", async () => {
    const setor = await db.reports.setor.create({ data: { id: crypto.randomUUID(), estabelecimentoId, nome: "Protocolo" } });
    const d = { contratoId, unidadeId: estabelecimentoId, setorId: setor.id, tipo: "treinamento" as const, prazo: somarDias(hojeLocal(), 5), observacao: "" };
    await cronograma.criarItemCronograma(d);
    await assert.rejects(clientes.removerSetor(setor.id), /itens ativos no cronograma/);
    await assert.rejects(clientes.removerUnidade(estabelecimentoId), /itens ativos no cronograma/);

    const [item] = await cronograma.listarCronograma(hojeLocal(), { contratoId });
    await cronograma.definirItemCronogramaCancelado(item.id, true);
    await clientes.removerSetor(setor.id);
    assert.equal(await cronograma.buscarItemCronograma(item.id), null, "o item cancelado saiu com o setor");
    assert.equal(await db.reports.setor.count({ where: { id: setor.id } }), 0);
  });

  // ---------- Importação do cronograma por planilha ----------

  const linhaPedido = (o: Record<string, unknown>) => ({ linha: 2, contratoId, unidade: { tipo: "existente", id: estabelecimentoId }, setor: null, atividade: "treinamento", prazo: "2026-12-01", observacao: "", ...o }) as Parameters<typeof importacao.gravarImportacao>[0][number];

  test("importação: grava estabelecimento e setores novos e os itens de uma vez, sem repetir", async () => {
    const novoPosto = { tipo: "nova", nome: "Posto Novo" } as const;
    const r = await importacao.gravarImportacao(
      [
        linhaPedido({ linha: 2, unidade: novoPosto, setor: { tipo: "novo", nome: "Triagem" } }),
        linhaPedido({ linha: 3, unidade: { tipo: "existente", id: estabelecimentoId }, setor: { tipo: "novo", nome: "Recepção" }, atividade: "implantacao", observacao: "  combinado  " }),
        linhaPedido({ linha: 4, unidade: { tipo: "nova", nome: "posto novo" }, setor: { tipo: "novo", nome: "TRIAGEM" } }), // mesmo item da linha 2
      ],
      true,
    );
    assert.deepEqual(r, { ok: true, criados: 2, ignorados: 1, estabelecimentosCriados: 1, setoresCriados: 2 });
    const posto = await db.reports.estabelecimento.findFirst({ where: { nome: "Posto Novo" }, include: { setores: true } });
    assert.equal(posto?.endereco, "");
    assert.equal(posto?.raioMetros, 50);
    assert.equal(posto?.latitude, null);
    assert.deepEqual(posto?.setores.map((x) => x.nome), ["Triagem"]);
    const itens = await cronograma.listarCronograma("2026-11-01", { contratoId });
    assert.equal(itens.length, 2);
    assert.equal(itens.find((i) => i.tipo === "implantacao")?.observacao, "combinado");
    assert.equal(itens.find((i) => i.unidadeNome === "Posto Novo")?.setorNome, "Triagem");
  });

  test("importação: sem permissão de cadastrar, só vale o que já existe, e nada é gravado", async () => {
    const r = await importacao.gravarImportacao([linhaPedido({ unidade: { tipo: "nova", nome: "Posto Proibido" } })], false);
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.erros[0].mensagem : "", /permissão para cadastrar/);
    assert.equal(await db.reports.estabelecimento.count({ where: { nome: "Posto Proibido" } }), 0);
    assert.equal((await cronograma.listarCronograma("2026-11-01", { contratoId })).length, 0);
    // O que já existe passa, mesmo sem a permissão.
    const ok = await importacao.gravarImportacao([linhaPedido({ unidade: { tipo: "nova", nome: "sede" } })], false);
    assert.equal(ok.ok && ok.criados, 1, "um nome que já existe vira o existente e não exige cadastrar");
    assert.equal(await db.reports.estabelecimento.count({ where: { nome: { equals: "sede", mode: "insensitive" } } }), 1);
  });

  test("importação: é tudo ou nada", async () => {
    const r = await importacao.gravarImportacao([linhaPedido({ linha: 2 }), linhaPedido({ linha: 3, prazo: "2026-02-30", atividade: "implantacao" })], true);
    assert.equal(r.ok, false);
    assert.deepEqual(!r.ok && r.erros.map((e) => e.linha), [3]);
    assert.equal((await cronograma.listarCronograma("2026-11-01", { contratoId })).length, 0, "a linha boa também não foi gravada");
  });

  test("importação: item que já existe é ignorado, e o pedido do navegador é conferido de novo", async () => {
    await cronograma.criarItemCronograma({ contratoId, unidadeId: estabelecimentoId, setorId: null, tipo: "treinamento", prazo: "2026-12-01", observacao: "" });
    const dup = await importacao.gravarImportacao([linhaPedido({})], true);
    assert.deepEqual(dup, { ok: true, criados: 0, ignorados: 1, estabelecimentosCriados: 0, setoresCriados: 0 });

    const outroCliente = await db.reports.estabelecimento.create({ data: { id: crypto.randomUUID(), clienteId: BigInt(clienteId) + BigInt(987654), nome: "De outro cliente", raioMetros: 50 } });
    const invalidos = [
      linhaPedido({ contratoId: "não-existe" }),
      linhaPedido({ unidade: { tipo: "existente", id: outroCliente.id } }),
      linhaPedido({ unidade: { tipo: "nova", nome: "   " } }),
      linhaPedido({ setor: { tipo: "existente", id: "setor-de-ninguém" } }),
      linhaPedido({ atividade: "churrasco" }),
      linhaPedido({ observacao: "x".repeat(501) }),
    ];
    for (const l of invalidos) assert.equal((await importacao.gravarImportacao([l], true)).ok, false, JSON.stringify(l).slice(0, 80));
    assert.equal((await importacao.gravarImportacao([], true)).ok, false);
    assert.equal((await cronograma.listarCronograma("2026-11-01", { contratoId })).length, 1, "só o item que já existia");
  });

  test("relatório: rascunho de um período sem visitas é permitido (cliente que só teve chamados de suporte)", async () => {
    const criado = await relatorios.criarRascunho(contratoId, "1990-01-01", "1990-01-31");
    assert.ok("relatorio" in criado, "erro" in criado ? criado.erro : "");
    assert.deepEqual(criado.relatorio.visitaIds, []);
    assert.equal((await relatorios.montarConteudo(criado.relatorio.id))!.visitas.length, 0);
    assert.ok("erro" in (await relatorios.criarRascunho(contratoId, "1990-01-15", "1990-02-15")), "o período sobreposto continua recusado");
    await relatorios.excluirRascunho(criado.relatorio.id);
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

  test("equipes: nome sem repetir (acento e maiúsculas), temas mínimos trocados na edição e inativação", async () => {
    const t1 = await temas.criarTema({ nome: "Prontuário eletrônico", sistema: "saude", modulo: "Atendimento" });
    const t2 = await temas.criarTema({ nome: "Prescrição médica", sistema: "saude", modulo: "Atendimento" });
    const e = await equipes.criarEquipe({ nome: "Equipe médica", temaIds: [t1.id, t1.id] });
    assert.deepEqual(e.temaIds, [t1.id]);
    assert.equal(await equipes.equipeDuplicada("EQUIPE MEDICA"), true);
    assert.equal(await equipes.equipeDuplicada("Equipe médica", e.id), false, "a própria equipe não conta como repetida");

    await equipes.atualizarEquipe(e.id, { nome: "Equipe médica", temaIds: [t2.id] });
    assert.deepEqual((await equipes.buscarEquipe(e.id))?.temaIds, [t2.id]);
    await equipes.definirEquipeAtiva(e.id, false);
    assert.equal((await equipes.listarEquipes())[0].ativo, false);
  });

  test("equipes treinadas ficam na visita e aparecem pelo nome, mesmo depois de inativadas", async () => {
    const t = await temas.criarTema({ nome: "Evolução de enfermagem", sistema: "saude", modulo: "Enfermagem" });
    const enfermagem = await equipes.criarEquipe({ nome: "Equipe de enfermagem", temaIds: [t.id] });
    const administrativa = await equipes.criarEquipe({ nome: "Equipe administrativa", temaIds: [t.id] });
    const v = await checkin();
    await visitas.definirEquipes(v.id, tecnico.id, [enfermagem.id, administrativa.id, enfermagem.id]);
    await equipes.definirEquipeAtiva(enfermagem.id, false);

    const lida = (await visitas.buscarVisita(v.id))!;
    assert.deepEqual(lida.equipeIds.sort(), [administrativa.id, enfermagem.id].sort());
    assert.deepEqual(lida.equipes, ["Equipe administrativa", "Equipe de enfermagem"]);

    await visitas.definirEquipes(v.id, tecnico.id, [administrativa.id]);
    assert.deepEqual((await visitas.buscarVisita(v.id))?.equipes, ["Equipe administrativa"]);
    await encerrar(v.id);
    await assert.rejects(visitas.definirEquipes(v.id, tecnico.id, []), /já foi encerrada/);
  });

  test("correção troca as equipes treinadas e registra no histórico", async () => {
    const t = await temas.criarTema({ nome: "Agendamento de consultas", sistema: "saude", modulo: "Recepção" });
    const recepcao = await equipes.criarEquipe({ nome: "Equipe de recepção", temaIds: [t.id] });
    const medica = await equipes.criarEquipe({ nome: "Equipe médica", temaIds: [t.id] });
    const v = await checkin();
    await visitas.definirEquipes(v.id, tecnico.id, [recepcao.id]);
    await encerrar(v.id);

    const antes = (await visitas.buscarVisita(v.id))!;
    const mudancas = await visitas.corrigirPelaAdministracao(v.id, { ...antes, saida: antes.saida!, equipeIds: [medica.id, recepcao.id], removerPresencas: [], removerFotos: [] }, tecnico, "faltou a equipe médica");
    assert.deepEqual(mudancas, [{ campo: "Equipes treinadas", antes: "Equipe de recepção", depois: "Equipe de recepção, Equipe médica" }]);
    const depois = (await visitas.buscarVisita(v.id))!;
    assert.deepEqual(depois.equipes, ["Equipe de recepção", "Equipe médica"]);
    assert.equal(depois.historico.at(-1)?.mudancas[0].campo, "Equipes treinadas");

    // Sem mudança nenhuma, nada é gravado.
    assert.deepEqual(await visitas.corrigirPelaAdministracao(v.id, { ...depois, saida: depois.saida!, removerPresencas: [], removerFotos: [] }, tecnico, "nada"), []);
  });

  test("o banco recusa período invertido e código CBO fora do formato", async () => {
    await assert.rejects(db.reports.relatorio.create({ data: { id: "r", clienteId: BigInt(clienteId), contratoId, de: new Date("2026-10-31"), ate: new Date("2026-10-01"), status: "rascunho" } }));
    await assert.rejects(db.reports.cbo.create({ data: { codigo: "12-34", titulo: "x" } }));
  });
});
