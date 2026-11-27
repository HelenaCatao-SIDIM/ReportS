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
  let configuracoes: typeof import("@/lib/repo/configuracoes");
  let auditoria: typeof import("@/lib/repo/auditoria");
  let requisicoes: typeof import("@/lib/repo/requisicoes");
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
    configuracoes = await import("@/lib/repo/configuracoes");
    auditoria = await import("@/lib/repo/auditoria");
    requisicoes = await import("@/lib/repo/requisicoes");

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
      tecnicoId: tecnico.id, clienteId, contratoId, unidadeId: estabelecimentoId, tipo: "reuniao", tipos: ["reuniao"],
      checkin: { latitude: -22.9, longitude: -47.06 }, meio: "celular", distanciaCheckinM: 10, raioCheckinM: 50,
      fotoAmbiente: { id: "f1", url: "/arquivos/f1" }, printTela: null, linkReuniao: null, equipeIds: [],
    });

  const encerrar = (id: string) => visitas.encerrarPeloTecnico(id, tecnico.id, { checkout: null, observacoes: "ok", pendencias: "", proximosPassos: "" });

  test("contrato guarda os aprovadores na ordem marcada e o e-mail em minúsculas", async () => {
    const c = await contratos.buscarContrato(contratoId);
    assert.deepEqual(c?.aprovadores.map((a) => a.nome), ["José", "Marta"]);
    assert.equal(c?.aprovadores[1].email, "marta@cliente.example");
    assert.equal(c?.sistemaDoClienteId, sistemaDoClienteId);
  });

  test("logs de requisição: grava com o usuário, filtra por método/desfecho/caminho e apaga os antigos", async () => {
    await requisicoes.registrarRequisicao({ metodo: "GET", caminho: "/admin/visitas", usuarioId: tecnico.id, ip: "1.2.3.4", desfecho: "ok" });
    await requisicoes.registrarRequisicao({ metodo: "POST", caminho: "/admin/clientes", usuarioId: null, ip: "", desfecho: "login" });
    await requisicoes.registrarRequisicao({ metodo: "GET", caminho: "/login", usuarioId: tecnico.id, ip: "1.2.3.4", desfecho: "inicio" });

    const todas = await requisicoes.listarRequisicoes();
    assert.equal(todas.length, 3);
    assert.equal(todas.find((r) => r.caminho === "/admin/clientes")!.usuarioNome, "—", "sem usuário logado: traço");
    assert.equal(todas.find((r) => r.caminho === "/admin/visitas")!.usuarioNome, tecnico.nome, "o nome do usuário é resolvido");

    assert.deepEqual((await requisicoes.listarRequisicoes({ metodo: "GET" })).map((r) => r.caminho).sort(), ["/admin/visitas", "/login"]);
    assert.deepEqual((await requisicoes.listarRequisicoes({ desfecho: "login" })).map((r) => r.caminho), ["/admin/clientes"]);
    assert.deepEqual((await requisicoes.listarRequisicoes({ texto: "VISITAS" })).map((r) => r.caminho), ["/admin/visitas"], "busca no caminho sem diferenciar caixa");

    // Faxina por idade: empurra uma linha para 40 dias atrás; só ela sai.
    await db.reports.requisicao.update({ where: { id: todas[0].id }, data: { em: new Date(Date.now() - 40 * 86_400_000) } });
    await requisicoes.apagarAntigas();
    assert.equal((await requisicoes.listarRequisicoes()).length, 2, "a de 40 dias saiu; as recentes ficam");
  });

  test("importação do CNES: cria por CNES e junta (não duplica) quem já tem o mesmo CNES", async () => {
    // Já existe um estabelecimento com CNES "1234567" (como se tivesse vindo do Saúde), com localização ajustada.
    await db.reports.estabelecimento.create({ data: { id: crypto.randomUUID(), clienteId: BigInt(clienteId), nome: "UBS Velha", cnes: "1234567", raioMetros: 50, latitude: -20, longitude: -44 } });

    const r1 = await clientes.importarEstabelecimentosDoCnes(clienteId, [
      { cnes: "1234567", nome: "UBS Central", endereco: "Rua A, 10", latitude: -21, longitude: -45 },
      { cnes: "7654321", nome: "UBS Nova", endereco: "Rua B, 20", latitude: -22, longitude: -46 },
    ], 50);
    assert.deepEqual(r1, { incluidos: 1, atualizados: 1 }, "um novo; o do mesmo CNES é atualizado, não duplicado");

    const porCnes = new Map((await clientes.listarUnidades(clienteId)).map((u) => [u.cnes, u]));
    assert.equal(porCnes.get("1234567")!.nome, "UBS Central", "atualizou o nome do que já existia");
    assert.deepEqual([porCnes.get("1234567")!.latitude, porCnes.get("1234567")!.longitude], [-20, -44], "não mexe na localização ajustada à mão");
    assert.equal(porCnes.get("7654321")!.nome, "UBS Nova");
    assert.deepEqual([porCnes.get("7654321")!.latitude, porCnes.get("7654321")!.longitude], [-22, -46], "o novo entra com a localização do CNES");
    assert.deepEqual((await clientes.cnesDoCliente(clienteId)).sort(), ["1234567", "7654321"], "os dois CNES (a Sede, sem CNES, fica de fora)");

    // Reimportar o mesmo CNES não duplica.
    const r2 = await clientes.importarEstabelecimentosDoCnes(clienteId, [{ cnes: "1234567", nome: "UBS Central", endereco: "", latitude: null, longitude: null }], 50);
    assert.deepEqual(r2, { incluidos: 0, atualizados: 1 });
    assert.equal((await clientes.listarUnidades(clienteId)).length, 3, "Sede + 2 do CNES; não duplicou");
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

  test("excluir visita: só encerrada e fora de relatório; a cascata leva presenças e histórico", async () => {
    const v = await checkin();
    assert.equal(await visitas.excluirVisita(v.id), "nao_encerrada", "em andamento não pode ser excluída");
    await encerrar(v.id);

    // Dentro de um relatório: bloqueada.
    const r = await relatorios.criarRascunho(contratoId, "1990-01-01", "2099-12-31");
    assert.ok("relatorio" in r);
    assert.equal(await visitas.excluirVisita(v.id), "em_relatorio", "visita em relatório não pode ser excluída");

    // Fora do relatório: excluída de vez.
    await relatorios.excluirRascunho(r.relatorio.id);
    assert.equal(await visitas.excluirVisita(v.id), "ok");
    assert.equal(await visitas.buscarVisita(v.id), null, "a visita some");
    assert.equal(await db.reports.alteracaoVisita.count({ where: { visitaId: v.id } }), 0, "o histórico some junto");
    assert.equal(await visitas.excluirVisita(v.id), "nao_encontrada", "excluir de novo não encontra");
  });

  test("auditoria: registra autor/ação/campos e filtra por tipo, período e busca", async () => {
    const autor = { id: tecnico.id, nome: tecnico.nome };
    await auditoria.registrarAuditoria({
      autor, entidade: "cliente", entidadeId: "c1", rotulo: "Prefeitura X", acao: "criar",
      mudancas: auditoria.mudancasDe([{ campo: "Nome", antes: undefined, depois: "Prefeitura X" }]),
    });
    await auditoria.registrarAuditoria({
      autor, entidade: "tema", entidadeId: "t1", rotulo: "Prontuário", acao: "editar",
      mudancas: auditoria.mudancasDe([
        { campo: "Nome", antes: "Prontuario", depois: "Prontuário" },
        { campo: "Sistema", antes: "saude", depois: "saude" },
      ]),
    });

    const tudo = await auditoria.listarAuditoria();
    assert.equal(tudo.length, 2);
    const cli = tudo.find((r) => r.entidade === "cliente")!;
    assert.equal(cli.autorNome, tecnico.nome);
    assert.equal(cli.acao, "criar");
    assert.equal(cli.rotulo, "Prefeitura X");
    assert.deepEqual(cli.mudancas, [{ campo: "Nome", antes: "—", depois: "Prefeitura X" }]);
    // mudancasDe tira o campo que não mudou (Sistema).
    const tema = tudo.find((r) => r.entidade === "tema")!;
    assert.deepEqual(tema.mudancas.map((m) => m.campo), ["Nome"]);

    // Filtros.
    assert.deepEqual((await auditoria.listarAuditoria({ entidade: "tema" })).map((r) => r.entidadeId), ["t1"]);
    assert.equal((await auditoria.listarAuditoria({ entidade: "contrato" })).length, 0, "tipo sem registro não traz nada");
    assert.deepEqual((await auditoria.listarAuditoria({ texto: "prontu" })).map((r) => r.rotulo), ["Prontuário"], "busca no rótulo, sem caixa");
    assert.equal((await auditoria.listarAuditoria({ texto: tecnico.nome })).length, 2, "busca pelo nome de quem fez");
    assert.equal((await auditoria.listarAuditoria({ de: new Date(Date.now() + 60_000).toISOString() })).length, 0, "período no futuro não traz nada");
  });

  // ---------- Cronograma de implantação ----------

  const hojeLocal = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const somarDias = (data: string, n: number) => new Date(Date.parse(`${data}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  /** Treinamento aberto com as equipes do check-in. */
  const treinoNo = (equipeIds: string[] = []) =>
    visitas.abrirVisita({
      tecnicoId: tecnico.id, clienteId, contratoId, unidadeId: estabelecimentoId, tipo: "treinamento", tipos: ["treinamento"],
      checkin: { latitude: -22.9, longitude: -47.06 }, meio: "celular", distanciaCheckinM: 10, raioCheckinM: 50,
      fotoAmbiente: { id: "f1", url: "/arquivos/f1" }, printTela: null, linkReuniao: null, equipeIds,
    });

  test("cronograma: só a visita encerrada, do tipo e do estabelecimento do item, que treinou as equipes dele, cumpre", async () => {
    const t = await temas.criarTema({ nome: "Prontuário", sistema: "saude", modulo: "Atendimento" });
    const medica = await equipes.criarEquipe({ nome: "Equipe médica", temaIds: [t.id] });
    const enfermagem = await equipes.criarEquipe({ nome: "Equipe de enfermagem", temaIds: [t.id] });
    const hoje = hojeLocal();
    const base = { contratoId, unidadeId: estabelecimentoId, tipo: "treinamento" as const, observacao: "" };
    await cronograma.criarItemCronograma({ ...base, equipeIds: [medica.id], prazo: somarDias(hoje, 10) });
    await cronograma.criarItemCronograma({ ...base, equipeIds: [enfermagem.id], prazo: somarDias(hoje, -1) });
    await cronograma.criarItemCronograma({ ...base, equipeIds: [], tipo: "implantacao", prazo: somarDias(hoje, 3) });

    const situacao = async () =>
      Object.fromEntries((await cronograma.listarCronograma(hoje, { contratoId })).map((i) => [`${i.equipeNomes.join("+") || "todas"}/${i.tipo}`, i.situacao]));
    assert.deepEqual(await situacao(), { "Equipe médica/treinamento": "no_prazo", "Equipe de enfermagem/treinamento": "atrasado", "todas/implantacao": "a_vencer" });

    // Em andamento não conta. As equipes vêm do check-in.
    const v = await treinoNo([medica.id]);
    assert.deepEqual((await visitas.buscarVisita(v.id))?.equipeIds, [medica.id], "o check-in grava as equipes");
    assert.equal((await situacao())["Equipe médica/treinamento"], "no_prazo");
    // Encerrada conta, só para a equipe que ela treinou.
    await encerrar(v.id);
    assert.deepEqual(await situacao(), { "Equipe médica/treinamento": "cumprido", "Equipe de enfermagem/treinamento": "atrasado", "todas/implantacao": "a_vencer" });

    // Visita cancelada não conta.
    const c = await treinoNo();
    await visitas.definirEquipes(c.id, tecnico.id, [enfermagem.id]);
    await visitas.cancelarPelaAdministracao(c.id, tecnico, "Check-in feito por engano");
    assert.equal((await situacao())["Equipe de enfermagem/treinamento"], "atrasado");
    // Depois do prazo, cumpre com atraso.
    const d = await treinoNo();
    await visitas.definirEquipes(d.id, tecnico.id, [enfermagem.id]);
    await encerrar(d.id);
    assert.equal((await situacao())["Equipe de enfermagem/treinamento"], "cumprido_com_atraso");

    const pendentes = await cronograma.listarPendentesDosContratos([contratoId], hoje);
    assert.deepEqual(pendentes.map((i) => i.tipo), ["implantacao"], "no check-in só aparece o que falta");
  });


  test("visita retroativa: já encerrada, sem GPS nem foto, marcada e no histórico; cumpre o cronograma; não cruza horário", async () => {
    const t = await temas.criarTema({ nome: "Regulação", sistema: "saude", modulo: "Atendimento" });
    const medica = await equipes.criarEquipe({ nome: "Médica (retroativa)", temaIds: [] });
    const hoje = hojeLocal();
    await cronograma.criarItemCronograma({ contratoId, unidadeId: estabelecimentoId, equipeIds: [medica.id], tipo: "treinamento", prazo: somarDias(hoje, -2), observacao: "" });
    const entrada = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const saida = new Date(Date.now() - 3 * 86_400_000 + 2 * 3600_000).toISOString();
    assert.equal(await visitas.tecnicoOcupadoNoHorario(tecnico.id, entrada, saida), false);
    const id = await visitas.lancarVisitaRetroativa(
      {
        tecnicoId: tecnico.id, clienteId, contratoId, unidadeId: estabelecimentoId, tipo: "treinamento", tipos: ["treinamento"], entrada, saida, linkReuniao: null,
        equipeIds: [medica.id], temaIds: [t.id], temaAdicional: "", observacoes: "Treinamento feito antes do ReportS", pendencias: "", proximosPassos: "",
        fotos: [], presencas: [],
      },
      tecnico,
      "visita anterior ao sistema",
    );
    const v = (await visitas.buscarVisita(id))!;
    assert.equal(v.status, "encerrada");
    assert.equal(v.meio, "retroativa");
    assert.equal(v.checkin, null);
    assert.equal(v.fotoAmbiente, null);
    assert.equal(v.entrada, entrada);
    assert.deepEqual(v.equipeIds, [medica.id]);
    assert.deepEqual(v.historico.map((h) => [h.acao, h.motivo]), [["lancamento", "visita anterior ao sistema"]]);
    assert.equal(await visitas.tecnicoOcupadoNoHorario(tecnico.id, entrada, saida), true, "o mesmo horário fica ocupado");
    const item = (await cronograma.listarCronograma(hoje, { contratoId })).find((i) => i.equipeNomes.includes("Médica (retroativa)"));
    assert.equal(item?.situacao, "cumprido", "a visita retroativa cumpre o item do cronograma");
  });

  test("a presença guarda como foi validada: login no Saúde, sem login (técnico) ou nada (login não exigido)", async () => {
    const v = await checkin();
    const pessoa = (id: string, nome: string, validacao?: "login_saude" | "sem_login" | null) => ({
      participanteId: id, estado: "confirmado" as const, nome, cbo: null, cpf: null, confirmacao: "nominal" as const, assinatura: null, validacao,
    });
    await visitas.adicionarPresenca(v.id, tecnico.id, pessoa("101", "Com login", "login_saude"));
    await visitas.adicionarPresenca(v.id, tecnico.id, pessoa("102", "Sem login", "sem_login"));
    await visitas.adicionarPresenca(v.id, tecnico.id, pessoa("103", "Login não exigido"));
    const lista = (await visitas.buscarVisita(v.id))!.presencas;
    assert.deepEqual(lista.map((p) => [p.nome, p.validacao]), [["Com login", "login_saude"], ["Sem login", "sem_login"], ["Login não exigido", null]]);
  });

  test("cronograma: duplicado, cancelar, e o relatório recebe o cronograma sem a observação interna", async () => {
    const hoje = hojeLocal();
    const t = await temas.criarTema({ nome: "Prontuário", sistema: "saude", modulo: "Atendimento" });
    const medica = await equipes.criarEquipe({ nome: "Equipe médica", temaIds: [t.id] });
    const d = { contratoId, unidadeId: estabelecimentoId, equipeIds: [medica.id], tipo: "treinamento" as const, prazo: somarDias(hoje, 20), observacao: "Combinado por telefone com o prefeito" };
    assert.equal(await cronograma.itemCronogramaDuplicado({ ...d, equipeIds: [] }), false);
    assert.equal(await cronograma.itemCronogramaDuplicado(d), false);
    await cronograma.criarItemCronograma(d);
    assert.equal(await cronograma.itemCronogramaDuplicado(d), true);
    assert.equal(await cronograma.itemCronogramaDuplicado({ ...d, equipeIds: [] }), false, "outras equipes: não é o mesmo item");
    assert.equal(await cronograma.itemCronogramaDuplicado({ ...d, prazo: somarDias(hoje, 21) }), false, "outro dia: não é o mesmo item");

    const [item] = await cronograma.listarCronograma(hoje, { contratoId });
    assert.deepEqual(item.equipeNomes, ["Equipe médica"]);
    await cronograma.atualizarItemCronograma(item.id, { unidadeId: estabelecimentoId, equipeIds: [], tipo: "treinamento", prazo: somarDias(hoje, 30), observacao: "Novo prazo" });
    assert.equal((await cronograma.buscarItemCronograma(item.id))?.prazo, somarDias(hoje, 30));
    assert.deepEqual((await cronograma.buscarItemCronograma(item.id))?.equipeIds, [], "a edição troca as equipes");

    const congelado = await cronograma.congelarCronograma(contratoId, hoje);
    assert.equal(congelado?.itens.length, 1);
    assert.deepEqual(congelado?.itens[0].equipes, []);
    assert.equal(congelado?.em, hoje);
    assert.ok(!JSON.stringify(congelado).includes("Novo prazo"), "a observação interna não vai para o cliente");

    await cronograma.definirItemCronogramaCancelado(item.id, true);
    assert.equal(await cronograma.itemCronogramaDuplicado({ ...d, equipeIds: [] }), false, "item cancelado não conta como duplicado");
    assert.equal(await cronograma.congelarCronograma(contratoId, hoje), null, "sem itens ativos, o relatório não mostra cronograma");
    await cronograma.definirItemCronogramaCancelado(item.id, false);
  });

  test("cronograma: item ativo impede remover o estabelecimento; o cancelado sai junto", async () => {
    await cronograma.criarItemCronograma({ contratoId, unidadeId: estabelecimentoId, equipeIds: [], tipo: "treinamento", prazo: somarDias(hojeLocal(), 5), observacao: "" });
    const [item] = await cronograma.listarCronograma(hojeLocal(), { contratoId });

    await assert.rejects(clientes.removerUnidade(estabelecimentoId), /itens ativos no cronograma/);
    await cronograma.definirItemCronogramaCancelado(item.id, true);
    const outra = await db.reports.estabelecimento.create({ data: { id: crypto.randomUUID(), clienteId: BigInt(clienteId), nome: "Anexo", raioMetros: 50 } });
    await cronograma.criarItemCronograma({ contratoId, unidadeId: outra.id, equipeIds: [], tipo: "treinamento", prazo: somarDias(hojeLocal(), 5), observacao: "" });
    const [doAnexo] = await cronograma.listarCronograma(hojeLocal(), { unidadeId: outra.id });
    await cronograma.definirItemCronogramaCancelado(doAnexo.id, true);
    await clientes.removerUnidade(outra.id);
    assert.equal(await cronograma.buscarItemCronograma(doAnexo.id), null, "o item cancelado saiu com o estabelecimento");
  });


  // ---------- Importação do cronograma por planilha ----------

  const linhaPedido = (o: Record<string, unknown>) => ({ linha: 2, contratoId, unidade: { tipo: "existente", id: estabelecimentoId }, equipeIds: [], atividade: "treinamento", prazo: "2026-12-01", horario: "", observacao: "", ...o }) as Parameters<typeof importacao.gravarImportacao>[0][number];

  test("importação: grava estabelecimento novo, os itens e as equipes de uma vez, sem repetir", async () => {
    const t = await temas.criarTema({ nome: "Prontuário", sistema: "saude", modulo: "Atendimento" });
    const medica = await equipes.criarEquipe({ nome: "Equipe médica", temaIds: [t.id] });
    const novoPosto = { tipo: "nova", nome: "Posto Novo" } as const;
    const r = await importacao.gravarImportacao(
      [
        linhaPedido({ linha: 2, unidade: novoPosto, equipeIds: [medica.id] }),
        linhaPedido({ linha: 3, unidade: { tipo: "existente", id: estabelecimentoId }, atividade: "implantacao", horario: " 09:30 e 14h ", observacao: "  combinado  " }),
        linhaPedido({ linha: 4, unidade: { tipo: "nova", nome: "posto novo" }, equipeIds: [medica.id, medica.id] }), // mesmo item da linha 2
      ],
      true,
    );
    assert.deepEqual(r, { ok: true, criados: 2, ignorados: 1, estabelecimentosCriados: 1 });
    const posto = await db.reports.estabelecimento.findFirst({ where: { nome: "Posto Novo" } });
    assert.equal(posto?.endereco, "");
    assert.equal(posto?.raioMetros, 50);
    assert.equal(posto?.latitude, null);
    const itens = await cronograma.listarCronograma("2026-11-01", { contratoId });
    assert.equal(itens.length, 2);
    assert.equal(itens.find((i) => i.tipo === "implantacao")?.observacao, "combinado");
    assert.equal(itens.find((i) => i.tipo === "implantacao")?.horario, "09:30 e 14h");
    assert.deepEqual(itens.find((i) => i.unidadeNome === "Posto Novo")?.equipeNomes, ["Equipe médica"]);

    // Equipe inativa não entra.
    await equipes.definirEquipeAtiva(medica.id, false);
    const inativa = await importacao.gravarImportacao([linhaPedido({ atividade: "reuniao", equipeIds: [medica.id] })], true);
    assert.equal(inativa.ok, false);
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
    await cronograma.criarItemCronograma({ contratoId, unidadeId: estabelecimentoId, equipeIds: [], tipo: "treinamento", prazo: "2026-12-01", observacao: "" });
    const dup = await importacao.gravarImportacao([linhaPedido({})], true);
    assert.deepEqual(dup, { ok: true, criados: 0, ignorados: 1, estabelecimentosCriados: 0 });

    const outroCliente = await db.reports.estabelecimento.create({ data: { id: crypto.randomUUID(), clienteId: BigInt(clienteId) + BigInt(987654), nome: "De outro cliente", raioMetros: 50 } });
    const invalidos = [
      linhaPedido({ contratoId: "não-existe" }),
      linhaPedido({ unidade: { tipo: "existente", id: outroCliente.id } }),
      linhaPedido({ unidade: { tipo: "nova", nome: "   " } }),
      linhaPedido({ equipeIds: ["equipe-de-ninguém"] }),
      linhaPedido({ equipeIds: "não é lista" }),
      linhaPedido({ atividade: "churrasco" }),
      linhaPedido({ observacao: "x".repeat(501) }),
    ];
    for (const l of invalidos) assert.equal((await importacao.gravarImportacao([l], true)).ok, false, JSON.stringify(l).slice(0, 80));
    assert.equal((await importacao.gravarImportacao([], true)).ok, false);
    assert.equal((await cronograma.listarCronograma("2026-11-01", { contratoId })).length, 1, "só o item que já existia");
  });

  test("contrato: o relatório de atendimentos nasce sintético, vira analítico e só muda quando o campo vem", async () => {
    const antes = (await contratos.buscarContrato(contratoId))!;
    assert.equal(antes.relatorioAtendimentos, "sintetico");
    const base = { texto: antes.texto, nivel: antes.nivel, exigeCpf: antes.exigeCpf, ativo: antes.ativo, aprovadorIds: antes.aprovadorIds };
    await contratos.salvarContrato(sistemaDoClienteId, { ...base, relatorioAtendimentos: "analitico" });
    assert.equal((await contratos.buscarContrato(contratoId))!.relatorioAtendimentos, "analitico");
    await contratos.salvarContrato(sistemaDoClienteId, { ...base, texto: "Contrato editado" });
    const depois = (await contratos.buscarContrato(contratoId))!;
    assert.equal(depois.relatorioAtendimentos, "analitico", "salvar sem o campo não muda o tipo");
    assert.equal(depois.texto, "Contrato editado");
    await contratos.salvarContrato(sistemaDoClienteId, { ...base, relatorioAtendimentos: "sintetico" });
    assert.equal((await contratos.buscarContrato(contratoId))!.relatorioAtendimentos, "sintetico");
  });

  test("configurações: o endereço do n8n é guardado e a chave de uma versão anterior é apagada", async () => {
    await db.reports.configuracao.deleteMany();
    assert.equal(await configuracoes.lerUrlN8n(), null);
    await db.reports.configuracao.create({ data: { chave: "n8n.resumo_chamados.chave", valor: "v1.a.b.c" } });
    await configuracoes.salvarUrlN8n("https://n8n.exemplo.com/webhook/resumo");
    assert.equal(await configuracoes.lerUrlN8n(), "https://n8n.exemplo.com/webhook/resumo");
    await configuracoes.salvarUrlN8n("https://n8n.exemplo.com/webhook/novo");
    assert.equal(await configuracoes.lerUrlN8n(), "https://n8n.exemplo.com/webhook/novo");
    assert.deepEqual((await db.reports.configuracao.findMany()).map((c) => c.chave), ["n8n.resumo_chamados.url"], "a chave antiga saiu");
    await db.reports.configuracao.deleteMany();
  });

  test("relatório: rascunho de um período sem visitas é permitido (cliente que só teve chamados de suporte)", async () => {
    const criado = await relatorios.criarRascunho(contratoId, "1990-01-01", "1990-01-31");
    assert.ok("relatorio" in criado, "erro" in criado ? criado.erro : "");
    assert.deepEqual(criado.relatorio.visitaIds, []);
    assert.equal((await relatorios.montarConteudo(criado.relatorio.id))!.visitas.length, 0);
    assert.ok("erro" in (await relatorios.criarRascunho(contratoId, "1990-01-15", "1990-02-15")), "o período sobreposto continua recusado");
    await relatorios.excluirRascunho(criado.relatorio.id);
  });

  test("relatório: emitir não envia, nova versão a qualquer momento, envio à parte, primeira decisão vale e as visitas travam", async () => {
    const v = await checkin();
    await encerrar(v.id);
    const hoje = new Date().toISOString().slice(0, 10);
    const criado = await relatorios.criarRascunho(contratoId, "2000-01-01", hoje);
    assert.ok("relatorio" in criado);
    const r = criado.relatorio;
    assert.deepEqual(r.visitaIds, [v.id]);
    assert.ok("erro" in (await relatorios.criarRascunho(contratoId, hoje, hoje)), "período sobreposto é recusado");
    const nova = async () =>
      relatorios.registrarEmissao(r.id, { conteudo: relatorios.congelar((await relatorios.montarConteudo(r.id))!), pdfUrl: "/arquivos/pdf", pdfTamanho: 10, emitidoEm: new Date().toISOString() });

    await assert.rejects(relatorios.registrarEnvio(r.id), /Emita a versão/, "sem versão emitida não há o que enviar");

    // Emitir não envia nada, não cria link e não muda para "enviado".
    const e1 = await nova();
    assert.equal(e1.versao.numero, 1);
    assert.deepEqual(e1.versao.enviadoPara, []);
    let atual = (await relatorios.buscarRelatorio(r.id))!;
    assert.equal(atual.status, "emitido");
    assert.deepEqual(atual.versoes[0].enviadoPara, []);

    // Dá para emitir de novo (v2) antes de enviar.
    assert.equal((await nova()).versao.numero, 2);
    assert.equal((await relatorios.buscarRelatorio(r.id))!.status, "emitido");

    // Envio à parte: um link por aprovador ativo, na última versão.
    const e = await relatorios.registrarEnvio(r.id);
    assert.equal(e.versao.numero, 2);
    assert.equal(e.links.length, 2);
    assert.equal(e.versao.enviadoPara.length, 2);
    atual = (await relatorios.buscarRelatorio(r.id))!;
    assert.equal(atual.status, "enviado");
    assert.equal(atual.versoes[1].enviadoPara.length, 2);
    assert.deepEqual(atual.versoes[0].enviadoPara, [], "a v1 nunca foi enviada");

    // Reenviar mantém os links que valem.
    const de2 = await relatorios.registrarEnvio(r.id);
    assert.deepEqual(de2.links.map((l) => l.token).sort(), e.links.map((l) => l.token).sort());

    // Depois de enviada, ainda dá para emitir v3: os links da v2 deixam de valer e o relatório volta a "emitido".
    assert.equal((await nova()).versao.numero, 3);
    assert.equal((await relatorios.buscarRelatorio(r.id))!.status, "emitido");
    assert.equal((await relatorios.buscarPorLink(e.links[0].token))?.podeDecidir, false, "link da versão substituída não decide");
    const v3 = await relatorios.registrarEnvio(r.id);
    assert.equal(v3.versao.numero, 3);
    assert.ok(v3.links.every((l) => !e.links.some((x) => x.token === l.token)), "a v3 tem links novos");

    // Os dois aprovadores decidem ao mesmo tempo: só um vale.
    const [d1, d2] = await Promise.all([
      relatorios.registrarDecisao(v3.links[0].token, "aprovado", null),
      relatorios.registrarDecisao(v3.links[1].token, "ajuste", "Faltou um nome"),
    ]);
    assert.equal([d1, d2].filter((d) => d.ok).length, 1);
    const final = (await relatorios.buscarRelatorio(r.id))!;
    assert.ok(final.status === "aprovado" || final.status === "ajuste_solicitado");
    assert.ok(final.versoes[2].decisao);
    assert.equal((await relatorios.buscarPorLink(v3.links[0].token))?.podeDecidir, false);

    if (final.status === "aprovado") {
      await assert.rejects(nova(), /não pode ser emitido/, "aprovado não ganha versão nova");
      await assert.rejects(relatorios.atualizarVisitasDoRascunho(r.id), /aprovado/);
      assert.equal((await visitas.buscarVisita(v.id))?.travada, true);
      await assert.rejects(
        visitas.corrigirPelaAdministracao(v.id, { ...(await visitas.buscarVisita(v.id))!, saida: new Date().toISOString(), removerPresencas: [], removerFotos: [], observacoes: "x" }, tecnico, "teste"),
        /relatório aprovado/,
      );
    } else {
      // Com ajuste pedido, emite a v4 e envia de novo.
      assert.equal((await nova()).versao.numero, 4);
      assert.equal((await relatorios.registrarEnvio(r.id)).versao.numero, 4);
    }
  });

  test("relatório: emitir não exige aprovador nem CNPJ, mas enviar por e-mail exige aprovador ativo", async () => {
    const v = await checkin();
    await encerrar(v.id);
    const sem = await contratos.salvarContrato(sistemaDoClienteId, { texto: "Contrato", nivel: "nominal", exigeCpf: false, ativo: true, aprovadorIds: [] });
    assert.deepEqual((await contratos.buscarContrato(sem.id))!.aprovadores, []);
    const criado = await relatorios.criarRascunho(sem.id, "2000-01-01", new Date().toISOString().slice(0, 10));
    assert.ok("relatorio" in criado);
    const id = criado.relatorio.id;
    const { versao } = await relatorios.registrarEmissao(id, { conteudo: relatorios.congelar((await relatorios.montarConteudo(id))!), pdfUrl: "/arquivos/pdf", pdfTamanho: 10, emitidoEm: new Date().toISOString() });
    assert.equal(versao.numero, 1);
    assert.equal((await relatorios.buscarRelatorio(id))!.status, "emitido");
    await assert.rejects(relatorios.registrarEnvio(id), /não tem aprovadores ativos/);
    assert.equal((await relatorios.buscarRelatorio(id))!.status, "emitido", "a falha no envio não muda o status");
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

  test("equipes: ocupações (CBO) gravadas sem repetir, trocadas na edição e mantidas quando a edição não as informa", async () => {
    await db.reports.cbo.createMany({
      data: [
        { codigo: "223505", titulo: "Enfermeiro" },
        { codigo: "322205", titulo: "Técnico de enfermagem" },
        { codigo: "322230", titulo: "Auxiliar de enfermagem" },
      ],
    });
    const t = await temas.criarTema({ nome: "Evolução de enfermagem", sistema: "saude", modulo: "Enfermagem" });
    const e = await equipes.criarEquipe({ nome: "Equipe de enfermagem", temaIds: [t.id], cboCodigos: ["322205", "223505", "223505"] });
    assert.deepEqual(e.cbos, [
      { codigo: "223505", titulo: "Enfermeiro" },
      { codigo: "322205", titulo: "Técnico de enfermagem" },
    ]);

    await equipes.atualizarEquipe(e.id, { nome: "Equipe de enfermagem", temaIds: [t.id], cboCodigos: ["322230"] });
    assert.deepEqual((await equipes.buscarEquipe(e.id))?.cbos.map((c) => c.codigo), ["322230"]);
    await equipes.atualizarEquipe(e.id, { nome: "Enfermagem", temaIds: [t.id] });
    assert.deepEqual((await equipes.buscarEquipe(e.id))?.cbos.map((c) => c.codigo), ["322230"], "sem cboCodigos, as ocupações ficam");
    // O banco só aceita CBO da tabela.
    await assert.rejects(db.reports.equipeCbo.create({ data: { equipeId: e.id, cboCodigo: "999999" } }));
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
