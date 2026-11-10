import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIMITE_LINHAS,
  chaveEstab,
  decisoesVazias,
  etapasDaLinha,
  lerAtividade,
  lerLinhas,
  lerHorario,
  lerPrazo,
  linhaResolvida,
  linhasQueExigemVoce,
  montarPedido,
  perguntasDaPlanilha,
  podeConfirmar,
  proximoDaFila,
  resolverLinhas,
  resumir,
  separarEquipes,
  type ContextoImportacao,
  type LinhaBruta,
} from "@/lib/importar-cronograma";

const CAB = ["Cliente", "Sistema", "Estabelecimento", "Equipe", "Atividade", "Prazo", "Observação"];

const ctx = (): ContextoImportacao => ({
  contratos: [
    { id: "c-sca", clienteId: "1", clienteNome: "Prefeitura de Vale Verde", sistemaCodigo: "sca", sistemaNome: "SCA", tenantId: null, ativo: true },
    { id: "c-serp", clienteId: "1", clienteNome: "Prefeitura de Vale Verde", sistemaCodigo: "serp", sistemaNome: "SERP", tenantId: null, ativo: true },
    { id: "c-saude", clienteId: "2", clienteNome: "Clínica Bem Viver", sistemaCodigo: "saude", sistemaNome: "Saúde", tenantId: null, ativo: false },
    { id: "c-x1", clienteId: "3", clienteNome: "Município X", sistemaCodigo: "serp", sistemaNome: "SERP", tenantId: "a", ativo: true },
    { id: "c-x2", clienteId: "3", clienteNome: "Município X", sistemaCodigo: "serp", sistemaNome: "SERP", tenantId: "b", ativo: true },
  ],
  unidades: {
    "1": [
      { id: "u-sede", nome: "Sede" },
      { id: "u-posto", nome: "Posto Central" },
    ],
    "3": [{ id: "u-x", nome: "Prédio X" }],
  },
  equipes: [
    { id: "e-med", nome: "Equipe médica" },
    { id: "e-enf", nome: "Equipe de enfermagem" },
    { id: "e-adm", nome: "Equipe administrativa" },
  ],
  existentes: [{ contratoId: "c-sca", unidadeId: "u-sede", equipeIds: ["e-med"], tipo: "treinamento", prazo: "2026-11-13" }],
});

const linha = (o: Partial<LinhaBruta> = {}): LinhaBruta => ({
  linha: 2, cliente: "Prefeitura de Vale Verde", sistema: "SCA", estabelecimento: "Sede", equipesTexto: "Equipe de enfermagem", equipes: ["Equipe de enfermagem"],
  atividadeTexto: "Treinamento", atividade: "treinamento", prazoTexto: "13/11/2026", prazo: "2026-11-13", horario: "", observacao: "", ...o,
});

test("lê a planilha: cabeçalho em qualquer ordem, sem acento nem caixa; ignora linhas em branco", () => {
  const r = lerLinhas([
    ["prazo", "ATIVIDADE", "estabelecimento", "Cliente", "sistema", "EQUIPES", "observacao", "Horário"],
    [new Date(Date.UTC(2026, 10, 13)), "treinamento", "Sede", "Prefeitura de Vale Verde", "SCA", "Equipe médica; Coordenação, equipe médica", "obs", "09:30 e 14h"],
    [null, null, null, null, null, null, null, null],
    ["14/11/2026", "Implantação", "Sede", "Prefeitura de Vale Verde", "SERP", null, null, null],
  ]);
  assert.equal(r.erro, undefined);
  assert.equal(r.linhas.length, 2);
  assert.deepEqual(r.linhas.map((l) => l.linha), [2, 4], "o número é o da linha na planilha");
  assert.equal(r.linhas[0].prazo, "2026-11-13");
  assert.equal(r.linhas[0].atividade, "treinamento");
  assert.deepEqual(r.linhas[0].equipes, ["Equipe médica", "Coordenação"], "separadas por ; ou , e sem repetir");
  assert.deepEqual(r.linhas[1].equipes, []);
  assert.equal(r.linhas[1].atividade, "implantacao");
  assert.equal(r.linhas[0].horario, "09:30 e 14h");
  assert.equal(r.linhas[1].horario, "", "horário é opcional");
});

test("horário: texto fica como veio; hora do Excel (data de 1899 ou fração do dia) vira HH:MM", () => {
  assert.equal(lerHorario("  Dia   todo "), "Dia todo");
  assert.equal(lerHorario(new Date(Date.UTC(1899, 11, 30, 9, 30))), "09:30");
  assert.equal(lerHorario(0.5833333333), "14:00");
  assert.equal(lerHorario(null), "");
});

test("a coluna 'Setor' é ignorada com aviso, porque o cronograma usa as equipes", () => {
  const r = lerLinhas([[...CAB, "Setor", "Coisa"], ["P", "SCA", "Sede", "", "Treinamento", "13/11/2026", "", "Recepção", "x"]]);
  assert.equal(r.linhas.length, 1);
  assert.equal(r.avisos.length, 2);
  assert.ok(r.avisos.some((a) => /Setor.*equipes/.test(a)));
  assert.deepEqual(separarEquipes(" ; Equipe médica,, "), ["Equipe médica"]);
});

test("planilha vazia, sem coluna obrigatória, só cabeçalho e linhas demais são recusadas", () => {
  assert.match(lerLinhas([]).erro ?? "", /vazia/);
  assert.match(lerLinhas([["Cliente", "Sistema"]]).erro ?? "", /Faltam colunas obrigatórias.*Estabelecimento.*Atividade.*Prazo/);
  assert.match(lerLinhas([CAB]).erro ?? "", /só tem o cabeçalho/);
  const muitas = [CAB, ...Array.from({ length: LIMITE_LINHAS + 1 }, () => ["P", "SCA", "Sede", "", "Treinamento", "13/11/2026", ""])];
  assert.match(lerLinhas(muitas).erro ?? "", /mais de 500 linhas/);
});

test("prazo aceita data do Excel, número de série e texto em vários formatos; recusa o que não é data", () => {
  assert.equal(lerPrazo(new Date(Date.UTC(2026, 10, 13))), "2026-11-13");
  assert.equal(lerPrazo("13/11/2026"), "2026-11-13");
  assert.equal(lerPrazo("3/1/2027"), "2027-01-03");
  assert.equal(lerPrazo("13-11-26"), "2026-11-13");
  assert.equal(lerPrazo("2026-11-13"), "2026-11-13");
  const serie = Math.round((Date.UTC(2026, 10, 13) - Date.UTC(1899, 11, 30)) / 86_400_000);
  assert.equal(lerPrazo(serie), "2026-11-13");
  assert.equal(lerPrazo("31/02/2026"), null);
  assert.equal(lerPrazo("amanhã"), null);
  assert.equal(lerPrazo(12), null, "número pequeno não é data");
  assert.equal(lerPrazo(null), null);
});

test("atividade pelo nome ou pelo código, sem acento nem caixa", () => {
  assert.equal(lerAtividade("Implantação"), "implantacao");
  assert.equal(lerAtividade("implantacao"), "implantacao");
  assert.equal(lerAtividade("TREINAMENTO ONLINE"), "treinamento_online");
  assert.equal(lerAtividade("treinamento_online"), "treinamento_online");
  assert.equal(lerAtividade("Suporte presencial"), "suporte_presencial");
  assert.equal(lerAtividade("churrasco"), null);
  assert.equal(lerAtividade(""), null);
});

test("o que existe bate sem diferenciar acento, caixa e espaço: a linha fica pronta", () => {
  const [r] = resolverLinhas([linha({ cliente: "  prefeitura DE vale  verde ", sistema: "sca", estabelecimento: "SEDE", equipes: ["EQUIPE DE ENFERMAGEM", "equipe medica"] })], ctx(), decisoesVazias());
  assert.equal(r.situacao, "pronta");
  assert.equal(r.contrato?.id, "c-sca");
  assert.deepEqual(r.unidade, { tipo: "existente", id: "u-sede", nome: "Sede" });
  assert.deepEqual(r.equipes?.map((e) => e.id), ["e-enf", "e-med"]);
});

test("sistema pelo código também serve; equipe em branco vale todas as equipes", () => {
  const [r] = resolverLinhas([linha({ sistema: "serp", equipes: [], equipesTexto: "" })], ctx(), decisoesVazias());
  assert.equal(r.contrato?.id, "c-serp");
  assert.deepEqual(r.equipes, []);
  assert.equal(r.situacao, "pronta");
});

test("equipe que não existe é erro do campo Equipes; escolher as equipes na tela resolve", () => {
  const [r] = resolverLinhas([linha({ equipes: ["Equipe médica", "Arquivo"], equipesTexto: "Equipe médica, Arquivo" })], ctx(), decisoesVazias());
  assert.equal(r.situacao, "erro");
  assert.equal(r.equipes, null);
  assert.match(r.problemaDoCampo.equipes ?? "", /“Arquivo”/);
  assert.equal(etapasDaLinha(r).atual, "equipes");

  const dec = decisoesVazias();
  dec.equipes[2] = ["e-adm", "e-fantasma"];
  const [ok] = resolverLinhas([linha({ equipes: ["Arquivo"] })], ctx(), dec);
  assert.equal(ok.situacao, "pronta");
  assert.deepEqual(ok.equipes?.map((e) => e.id), ["e-adm"], "id que não é de equipe ativa é descartado");
  dec.equipes[2] = [];
  assert.deepEqual(resolverLinhas([linha({ equipes: ["Arquivo"] })], ctx(), dec)[0].equipes, [], "nenhuma marcada = todas as equipes");
});

test("estabelecimento que não existe vira pergunta, com sugestão do mais parecido", () => {
  const [r] = resolverLinhas([linha({ estabelecimento: "Posto Centrall" })], ctx(), decisoesVazias());
  assert.equal(r.situacao, "decidir");
  assert.equal(r.perguntas.length, 1);
  assert.equal(r.perguntas[0].campo, "estabelecimento");
  assert.equal(r.perguntas[0].sugerido, "u-posto");
  assert.deepEqual(r.perguntas[0].existentes.map((e) => e.nome), ["Sede", "Posto Central"]);
  assert.equal(r.perguntas[0].onde, "Prefeitura de Vale Verde");
});

test("decidir 'cadastrar' o estabelecimento: ele é novo e a linha fica pronta", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  const [r] = resolverLinhas([linha({ estabelecimento: "Posto Norte" })], ctx(), dec);
  assert.equal(r.situacao, "pronta");
  assert.equal(r.unidade?.tipo, "nova");
});

test("decidir 'alterar' para um existente: usa ele", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Centrall")] = { acao: "usar", id: "u-posto" };
  const [achou] = resolverLinhas([linha({ estabelecimento: "Posto Centrall" })], ctx(), dec);
  assert.equal(achou.situacao, "pronta");
  assert.deepEqual(achou.unidade, { tipo: "existente", id: "u-posto", nome: "Posto Central" });
  assert.equal(achou.perguntas.length, 1, "a pergunta respondida continua na lista");
});

test("a mesma pergunta aparece uma vez só, com todas as linhas que usam o nome", () => {
  const rs = resolverLinhas([linha({ linha: 2, estabelecimento: "Posto Norte" }), linha({ linha: 3, estabelecimento: "posto norte", atividade: "implantacao", atividadeTexto: "Implantação" })], ctx(), decisoesVazias());
  const ps = perguntasDaPlanilha(rs);
  assert.equal(ps.length, 1);
  assert.deepEqual(ps[0].linhas, [2, 3]);
});

test("a pergunta respondida continua na lista, com a resposta, para poder mudar de ideia", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  const rs = resolverLinhas([linha({ estabelecimento: "Posto Norte" })], ctx(), dec);
  const ps = perguntasDaPlanilha(rs);
  assert.equal(ps.length, 1);
  assert.deepEqual(ps[0].decisao, { acao: "cadastrar" });
  assert.equal(rs[0].situacao, "pronta");

  // Trocar a resposta por um existente com id que não existe não conta como resposta.
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "usar", id: "u-fantasma" };
  const [ruim] = resolverLinhas([linha({ estabelecimento: "Posto Norte" })], ctx(), dec);
  assert.equal(ruim.situacao, "decidir");
  assert.equal(ruim.perguntas[0].decisao, null);
});

test("contrato: cliente que não existe, sistema que o cliente não tem, inativo e ambíguo exigem escolha", () => {
  const semCliente = resolverLinhas([linha({ cliente: "Fulano" })], ctx(), decisoesVazias())[0];
  assert.equal(semCliente.situacao, "erro");
  assert.match(semCliente.problemas[0], /não foi encontrado/);
  assert.ok(semCliente.contratoOpcoes.length > 0);

  const semSistema = resolverLinhas([linha({ sistema: "SE" })], ctx(), decisoesVazias())[0];
  assert.match(semSistema.problemas[0], /não tem contrato do sistema/);

  const inativo = resolverLinhas([linha({ cliente: "Clínica Bem Viver", sistema: "Saúde" })], ctx(), decisoesVazias())[0];
  assert.match(inativo.problemas[0], /inativo/);

  const ambiguo = resolverLinhas([linha({ cliente: "Município X", sistema: "SERP", estabelecimento: "Prédio X" })], ctx(), decisoesVazias())[0];
  assert.equal(ambiguo.situacao, "erro");
  assert.match(ambiguo.problemas[0], /mais de um contrato/);
  assert.equal(ambiguo.contratoOpcoes.length, 2);

  const dec = decisoesVazias();
  dec.contrato[2] = "c-x2";
  const escolhido = resolverLinhas([linha({ cliente: "Município X", sistema: "SERP", estabelecimento: "Prédio X" })], ctx(), dec)[0];
  assert.equal(escolhido.situacao, "pronta");
  assert.equal(escolhido.contrato?.id, "c-x2");
});

test("atividade e prazo inválidos viram erro, e a correção na tela resolve", () => {
  const ruim = linha({ atividadeTexto: "churrasco", atividade: null, prazoTexto: "amanhã", prazo: null });
  const [r] = resolverLinhas([ruim], ctx(), decisoesVazias());
  assert.equal(r.situacao, "erro");
  assert.equal(r.problemas.length, 2);
  const dec = decisoesVazias();
  dec.atividade[2] = "implantacao";
  dec.prazo[2] = "2026-12-01";
  const [ok] = resolverLinhas([ruim], ctx(), dec);
  assert.equal(ok.situacao, "pronta");
  assert.equal(ok.atividade, "implantacao");
  assert.equal(ok.prazo, "2026-12-01");
});

test("duplicado: item que já existe e linha repetida na planilha não entram (equipes em qualquer ordem)", () => {
  const rs = resolverLinhas(
    [
      linha({ linha: 2, equipes: ["Equipe médica"] }), // já existe (c-sca, Sede, Equipe médica, treinamento)
      linha({ linha: 3, equipes: ["Equipe médica", "Equipe de enfermagem"] }),
      linha({ linha: 4, equipes: ["equipe de enfermagem", "EQUIPE MÉDICA"] }), // repete a anterior
    ],
    ctx(),
    decisoesVazias(),
  );
  assert.deepEqual(rs.map((r) => r.situacao), ["duplicada", "pronta", "duplicada"]);
  assert.match(rs[0].motivoDuplicada ?? "", /Já existe/);
  assert.match(rs[2].motivoDuplicada ?? "", /Repetida/);
});

test("mesmo item em dias diferentes não é repetido: o cronograma pode ter um item por dia", () => {
  const rs = resolverLinhas(
    [
      linha({ linha: 2, equipes: ["Equipe médica"], prazo: "2026-11-05" }), // o existente é de 13/11
      linha({ linha: 3, equipes: ["Equipe médica"], prazo: "2026-11-06" }),
      linha({ linha: 4, equipes: ["Equipe médica"], prazo: "2026-11-06" }), // repete a anterior, no mesmo dia
    ],
    ctx(),
    decisoesVazias(),
  );
  assert.deepEqual(rs.map((r) => r.situacao), ["pronta", "pronta", "duplicada"]);
});

test("pular tira a linha da conta, mesmo com erro ou pergunta", () => {
  const dec = decisoesVazias();
  dec.pular[2] = true;
  const [r] = resolverLinhas([linha({ cliente: "Fulano" })], ctx(), dec);
  assert.equal(r.situacao, "pulada");
  assert.equal(perguntasDaPlanilha([r]).length, 0);
});

test("resumo e pedido: só as prontas entram, e o que será cadastrado aparece sem repetição", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  const rs = resolverLinhas(
    [
      linha({ linha: 2, estabelecimento: "Posto Norte" }),
      linha({ linha: 3, estabelecimento: "posto norte", atividade: "implantacao", atividadeTexto: "Implantação" }),
      linha({ linha: 4, equipes: ["Equipe administrativa"] }),
      linha({ linha: 5, equipes: ["Equipe médica"] }), // duplicada de item existente
      linha({ linha: 6, cliente: "Fulano" }), // erro
    ],
    ctx(),
    dec,
  );
  const r = resumir(rs);
  assert.deepEqual({ total: r.total, prontas: r.prontas, duplicadas: r.duplicadas, erro: r.erro, decidir: r.decidir }, { total: 5, prontas: 3, duplicadas: 1, erro: 1, decidir: 0 });
  assert.equal(r.estabelecimentosNovos.length, 1, "o mesmo estabelecimento novo conta uma vez");
  assert.equal(r.estabelecimentosNovos[0].nome, "Posto Norte", "e vale o nome da primeira linha (a segunda escreveu em minúsculas)");
  assert.equal(podeConfirmar(r), false, "a linha com erro impede confirmar até ser corrigida ou pulada");

  dec.pular[6] = true;
  const r2 = resumir(resolverLinhas([...rs.map((x) => x.bruta)], ctx(), dec));
  assert.equal(podeConfirmar(r2), true);
  const pedido = montarPedido(resolverLinhas(rs.map((x) => x.bruta), ctx(), dec));
  assert.equal(pedido.length, 3);
  assert.deepEqual(pedido[0].unidade, { tipo: "nova", nome: "Posto Norte" });
  assert.deepEqual(pedido[2].equipeIds, ["e-adm"]);
  assert.deepEqual(pedido[0].equipeIds, ["e-enf"]);
  assert.ok(pedido.every((p) => p.contratoId === "c-sca"));
});

// ---------- Revisão em etapas: um item por vez ----------

test("etapas: item certo não precisa de ninguém; o que tem pergunta ou erro entra na fila, na ordem da planilha", () => {
  const rs = resolverLinhas(
    [
      linha({ linha: 2 }), // pronta
      linha({ linha: 3, estabelecimento: "Posto Norte" }), // pergunta
      linha({ linha: 4, equipes: ["Equipe médica"] }), // duplicada de item existente
      linha({ linha: 5, cliente: "Fulano" }), // erro de contrato
    ],
    ctx(),
    decisoesVazias(),
  );
  assert.deepEqual(rs.map(linhaResolvida), [true, false, true, false]);
  assert.deepEqual(linhasQueExigemVoce(rs).map((l) => l.bruta.linha), [3, 5]);
});

test("etapas: o item para no primeiro campo sem resposta e só mostra até ele", () => {
  // Estabelecimento novo + atividade e prazo ruins: pergunta o estabelecimento antes de qualquer outra coisa.
  const ruim = linha({ estabelecimento: "Posto Norte", atividadeTexto: "churrasco", atividade: null, prazoTexto: "amanhã", prazo: null });
  const [a] = resolverLinhas([ruim], ctx(), decisoesVazias());
  let e = etapasDaLinha(a);
  assert.equal(e.atual, "estabelecimento");
  assert.deepEqual(e.visiveis, ["contrato", "estabelecimento"]);

  // Cadastrar o estabelecimento resolve; as equipes já batem, e a tela passa para a atividade.
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  e = etapasDaLinha(resolverLinhas([ruim], ctx(), dec)[0]);
  assert.equal(e.atual, "atividade");
  assert.deepEqual(e.visiveis, ["contrato", "estabelecimento", "equipes", "atividade"]);

  // Corrigida a atividade, aparece o prazo; corrigido o prazo, nada falta e todos os campos ficam visíveis.
  dec.atividade[2] = "implantacao";
  e = etapasDaLinha(resolverLinhas([ruim], ctx(), dec)[0]);
  assert.equal(e.atual, "prazo");
  dec.prazo[2] = "2026-12-01";
  const [pronta] = resolverLinhas([ruim], ctx(), dec);
  e = etapasDaLinha(pronta);
  assert.equal(e.atual, null);
  assert.equal(e.visiveis.length, 5);
  assert.equal(pronta.situacao, "pronta");
});

test("etapas: contrato sem correspondência vem primeiro; equipe que não existe só aparece depois de resolver o estabelecimento", () => {
  const [semContrato] = resolverLinhas([linha({ cliente: "Fulano", estabelecimento: "Posto Norte" })], ctx(), decisoesVazias());
  assert.equal(etapasDaLinha(semContrato).atual, "contrato");
  assert.deepEqual(etapasDaLinha(semContrato).visiveis, ["contrato"]);
  assert.match(semContrato.problemaDoCampo.contrato ?? "", /não foi encontrado/);

  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Centrall")] = { acao: "usar", id: "u-posto" };
  const [equipeRuim] = resolverLinhas([linha({ estabelecimento: "Posto Centrall", equipes: ["Arquivo"] })], ctx(), dec);
  assert.equal(etapasDaLinha(equipeRuim).atual, "equipes", "a equipe Arquivo não existe");
  const [semResposta] = resolverLinhas([linha({ estabelecimento: "Posto Norte", equipes: ["Arquivo"] })], ctx(), decisoesVazias());
  assert.equal(etapasDaLinha(semResposta).atual, "estabelecimento", "o estabelecimento vem antes das equipes");
});

test("etapas: nome em branco ou grande demais não tem conserto na tela, só pulando", () => {
  const [semNome] = resolverLinhas([linha({ estabelecimento: "" })], ctx(), decisoesVazias());
  assert.equal(semNome.situacao, "erro");
  assert.deepEqual(semNome.semConserto, ["Estabelecimento em branco."]);
  assert.deepEqual(semNome.problemaDoCampo, {}, "não há campo para corrigir");
  assert.equal(etapasDaLinha(semNome).atual, "estabelecimento");

  const [obsGrande] = resolverLinhas([linha({ observacao: "x".repeat(501) })], ctx(), decisoesVazias());
  assert.equal(obsGrande.situacao, "erro");
  assert.equal(etapasDaLinha(obsGrande).atual, null, "todos os campos estão resolvidos, mas a observação impede");
  assert.equal(etapasDaLinha(obsGrande).semConserto.length, 1);

  const dec = decisoesVazias();
  dec.pular[2] = true;
  assert.equal(linhaResolvida(resolverLinhas([linha({ estabelecimento: "" })], ctx(), dec)[0]), true, "pular resolve");
});

test("etapas: a resposta de um item resolve os outros que usam o mesmo nome, e o próximo pula os já resolvidos", () => {
  const brutas = [
    linha({ linha: 2, estabelecimento: "Posto Norte" }),
    linha({ linha: 3, estabelecimento: "posto norte", atividade: "implantacao", atividadeTexto: "Implantação" }),
    linha({ linha: 4, cliente: "Fulano" }),
    linha({ linha: 5, equipes: ["Arquivo"] }),
  ];
  const inicial = resolverLinhas(brutas, ctx(), decisoesVazias());
  const fila = linhasQueExigemVoce(inicial).map((l) => l.bruta.linha);
  assert.deepEqual(fila, [2, 3, 4, 5]);

  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  const agora = resolverLinhas(brutas, ctx(), dec);
  const filaAgora = fila.map((n) => agora.find((l) => l.bruta.linha === n)!);
  assert.deepEqual(filaAgora.map((l) => l.situacao), ["pronta", "pronta", "erro", "erro"], "as linhas 2 e 3 usam o mesmo nome");
  assert.equal(proximoDaFila(filaAgora, 0), 2, "do item 1 vai direto ao 3º: o 2º já foi resolvido pela mesma resposta");
  assert.equal(proximoDaFila(filaAgora, 2), 3);
  assert.equal(proximoDaFila(filaAgora, 3), 4, "depois do último pendente vem o resumo (índice = tamanho da fila)");

  dec.pular[4] = true;
  dec.equipes[5] = ["e-adm"];
  const tudo = resolverLinhas(brutas, ctx(), dec);
  const filaTudo = fila.map((n) => tudo.find((l) => l.bruta.linha === n)!);
  assert.equal(proximoDaFila(filaTudo, 0), 4, "nada pendente: direto ao resumo");
  assert.equal(podeConfirmar(resumir(tudo)), true);
});
