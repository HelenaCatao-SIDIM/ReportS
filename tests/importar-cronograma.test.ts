import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIMITE_LINHAS,
  chaveEstab,
  chaveSetor,
  decisoesVazias,
  lerAtividade,
  lerLinhas,
  lerPrazo,
  montarPedido,
  perguntasDaPlanilha,
  podeConfirmar,
  resolverLinhas,
  resumir,
  type ContextoImportacao,
  type LinhaBruta,
} from "@/lib/importar-cronograma";

const CAB = ["Cliente", "Sistema", "Estabelecimento", "Setor", "Atividade", "Prazo", "Observação"];

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
      { id: "u-sede", nome: "Sede", setores: [{ id: "s-prot", nome: "Protocolo" }, { id: "s-rh", nome: "Recursos Humanos" }] },
      { id: "u-posto", nome: "Posto Central", setores: [{ id: "s-rec", nome: "Recepção" }] },
    ],
    "3": [{ id: "u-x", nome: "Prédio X", setores: [] }],
  },
  existentes: [{ contratoId: "c-sca", unidadeId: "u-sede", setorId: "s-prot", tipo: "treinamento" }],
});

const linha = (o: Partial<LinhaBruta> = {}): LinhaBruta => ({
  linha: 2, cliente: "Prefeitura de Vale Verde", sistema: "SCA", estabelecimento: "Sede", setor: "Recursos Humanos",
  atividadeTexto: "Treinamento", atividade: "treinamento", prazoTexto: "13/11/2026", prazo: "2026-11-13", observacao: "", ...o,
});

test("lê a planilha: cabeçalho em qualquer ordem, sem acento nem caixa; ignora linhas em branco", () => {
  const r = lerLinhas([
    ["prazo", "ATIVIDADE", "estabelecimento", "Cliente", "sistema", "SETOR", "observacao"],
    [new Date(Date.UTC(2026, 10, 13)), "treinamento", "Sede", "Prefeitura de Vale Verde", "SCA", "Protocolo", "obs"],
    [null, null, null, null, null, null, null],
    ["14/11/2026", "Implantação", "Sede", "Prefeitura de Vale Verde", "SERP", null, null],
  ]);
  assert.equal(r.erro, undefined);
  assert.equal(r.linhas.length, 2);
  assert.deepEqual(r.linhas.map((l) => l.linha), [2, 4], "o número é o da linha na planilha");
  assert.equal(r.linhas[0].prazo, "2026-11-13");
  assert.equal(r.linhas[0].atividade, "treinamento");
  assert.equal(r.linhas[1].setor, "");
  assert.equal(r.linhas[1].atividade, "implantacao");
});

test("a coluna 'Equipe' é ignorada com aviso, porque o cronograma usa Setor", () => {
  const r = lerLinhas([[...CAB, "Equipe", "Coisa"], ["P", "SCA", "Sede", "", "Treinamento", "13/11/2026", "", "Médica", "x"]]);
  assert.equal(r.linhas.length, 1);
  assert.equal(r.avisos.length, 2);
  assert.ok(r.avisos.some((a) => /Equipe.*Setor/.test(a)));
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
  const [r] = resolverLinhas([linha({ cliente: "  prefeitura DE vale  verde ", sistema: "sca", estabelecimento: "SEDE", setor: "recursos humanos" })], ctx(), decisoesVazias());
  assert.equal(r.situacao, "pronta");
  assert.equal(r.contrato?.id, "c-sca");
  assert.deepEqual(r.unidade, { tipo: "existente", id: "u-sede", nome: "Sede" });
  assert.deepEqual(r.setor, { tipo: "existente", id: "s-rh", nome: "Recursos Humanos" });
});

test("sistema pelo código também serve; setor em branco vale todos os setores", () => {
  const [r] = resolverLinhas([linha({ sistema: "serp", setor: "" })], ctx(), decisoesVazias());
  assert.equal(r.contrato?.id, "c-serp");
  assert.equal(r.setor, null);
  assert.equal(r.situacao, "pronta");
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

test("decidir 'cadastrar' o estabelecimento: ele é novo e o setor dele nasce junto, sem outra pergunta", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  const [r] = resolverLinhas([linha({ estabelecimento: "Posto Norte", setor: "Triagem" })], ctx(), dec);
  assert.equal(r.situacao, "pronta");
  assert.equal(r.unidade?.tipo, "nova");
  assert.equal(r.setor && r.setor.tipo, "novo");
});

test("decidir 'alterar' para um existente: usa ele, e o setor é procurado nele (e pergunta se não existir lá)", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Centrall")] = { acao: "usar", id: "u-posto" };
  const [achou] = resolverLinhas([linha({ estabelecimento: "Posto Centrall", setor: "Recepção" })], ctx(), dec);
  assert.equal(achou.situacao, "pronta");
  assert.deepEqual(achou.unidade, { tipo: "existente", id: "u-posto", nome: "Posto Central" });
  assert.deepEqual(achou.setor, { tipo: "existente", id: "s-rec", nome: "Recepção" });

  const [naoAchou] = resolverLinhas([linha({ estabelecimento: "Posto Centrall", setor: "Protocolo" })], ctx(), dec);
  assert.equal(naoAchou.situacao, "decidir");
  const pendente = naoAchou.perguntas.find((q) => !q.decisao);
  assert.equal(pendente?.campo, "setor");
  assert.equal(pendente?.onde, "Posto Central");
  assert.equal(naoAchou.perguntas.length, 2, "a do estabelecimento (respondida) continua na lista, junto com a do setor");
});

test("setor que não existe num estabelecimento que existe: pergunta; cadastrar ou usar outro resolve", () => {
  const [pergunta] = resolverLinhas([linha({ setor: "Tributação" })], ctx(), decisoesVazias());
  assert.equal(pergunta.situacao, "decidir");
  assert.equal(pergunta.perguntas[0].campo, "setor");

  const k = chaveSetor("u-sede", "Tributação");
  const cad = decisoesVazias();
  cad.setor[k] = { acao: "cadastrar" };
  assert.equal(resolverLinhas([linha({ setor: "Tributação" })], ctx(), cad)[0].setor?.tipo, "novo");

  const usar = decisoesVazias();
  usar.setor[k] = { acao: "usar", id: "s-rh" };
  const [r] = resolverLinhas([linha({ setor: "Tributação" })], ctx(), usar);
  assert.equal(r.situacao, "pronta");
  assert.deepEqual(r.setor, { tipo: "existente", id: "s-rh", nome: "Recursos Humanos" });
});

test("a mesma pergunta aparece uma vez só, com todas as linhas que usam o nome", () => {
  const rs = resolverLinhas([linha({ linha: 2, setor: "Tributação" }), linha({ linha: 3, setor: "tributacao", atividade: "implantacao", atividadeTexto: "Implantação" })], ctx(), decisoesVazias());
  const ps = perguntasDaPlanilha(rs);
  assert.equal(ps.length, 1);
  assert.deepEqual(ps[0].linhas, [2, 3]);
});

test("a pergunta respondida continua na lista, com a resposta, para poder mudar de ideia", () => {
  const dec = decisoesVazias();
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "cadastrar" };
  const rs = resolverLinhas([linha({ estabelecimento: "Posto Norte", setor: "" })], ctx(), dec);
  const ps = perguntasDaPlanilha(rs);
  assert.equal(ps.length, 1);
  assert.deepEqual(ps[0].decisao, { acao: "cadastrar" });
  assert.equal(rs[0].situacao, "pronta");

  // Trocar a resposta por um existente com id que não existe não conta como resposta.
  dec.estab[chaveEstab("1", "Posto Norte")] = { acao: "usar", id: "u-fantasma" };
  const [ruim] = resolverLinhas([linha({ estabelecimento: "Posto Norte", setor: "" })], ctx(), dec);
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

  const ambiguo = resolverLinhas([linha({ cliente: "Município X", sistema: "SERP", estabelecimento: "Prédio X", setor: "" })], ctx(), decisoesVazias())[0];
  assert.equal(ambiguo.situacao, "erro");
  assert.match(ambiguo.problemas[0], /mais de um contrato/);
  assert.equal(ambiguo.contratoOpcoes.length, 2);

  const dec = decisoesVazias();
  dec.contrato[2] = "c-x2";
  const escolhido = resolverLinhas([linha({ cliente: "Município X", sistema: "SERP", estabelecimento: "Prédio X", setor: "" })], ctx(), dec)[0];
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

test("duplicado: item que já existe e linha repetida na planilha não entram", () => {
  const rs = resolverLinhas(
    [
      linha({ linha: 2, setor: "Protocolo" }), // já existe (c-sca, Sede, Protocolo, treinamento)
      linha({ linha: 3, setor: "Recursos Humanos" }),
      linha({ linha: 4, setor: "recursos humanos" }), // repete a anterior
    ],
    ctx(),
    decisoesVazias(),
  );
  assert.deepEqual(rs.map((r) => r.situacao), ["duplicada", "pronta", "duplicada"]);
  assert.match(rs[0].motivoDuplicada ?? "", /Já existe/);
  assert.match(rs[2].motivoDuplicada ?? "", /Repetida/);
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
  dec.setor[chaveSetor("u-sede", "Tributação")] = { acao: "cadastrar" };
  const rs = resolverLinhas(
    [
      linha({ linha: 2, estabelecimento: "Posto Norte", setor: "Triagem" }),
      linha({ linha: 3, estabelecimento: "posto norte", setor: "Triagem", atividade: "implantacao", atividadeTexto: "Implantação" }),
      linha({ linha: 4, setor: "Tributação" }),
      linha({ linha: 5, setor: "Protocolo" }), // duplicada de item existente
      linha({ linha: 6, cliente: "Fulano" }), // erro
    ],
    ctx(),
    dec,
  );
  const r = resumir(rs);
  assert.deepEqual({ total: r.total, prontas: r.prontas, duplicadas: r.duplicadas, erro: r.erro, decidir: r.decidir }, { total: 5, prontas: 3, duplicadas: 1, erro: 1, decidir: 0 });
  assert.equal(r.estabelecimentosNovos.length, 1, "o mesmo estabelecimento novo conta uma vez");
  assert.equal(r.setoresNovos.length, 2, "Triagem (no posto novo) e Tributação (na Sede)");
  assert.equal(podeConfirmar(r), false, "a linha com erro impede confirmar até ser corrigida ou pulada");

  dec.pular[6] = true;
  const r2 = resumir(resolverLinhas([...rs.map((x) => x.bruta)], ctx(), dec));
  assert.equal(podeConfirmar(r2), true);
  const pedido = montarPedido(resolverLinhas(rs.map((x) => x.bruta), ctx(), dec));
  assert.equal(pedido.length, 3);
  assert.deepEqual(pedido[0].unidade, { tipo: "nova", nome: "Posto Norte" });
  assert.deepEqual(pedido[2].setor, { tipo: "novo", nome: "Tributação" });
  assert.ok(pedido.every((p) => p.contratoId === "c-sca"));
});
