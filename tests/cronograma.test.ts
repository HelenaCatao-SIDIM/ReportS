import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIAS_A_VENCER,
  ROTULO_SITUACAO_RELATORIO,
  calcularSituacao,
  calcularSituacoes,
  contarPorSituacao,
  descreverPrazo,
  diasEntre,
  equipesDoItem,
  estaPendente,
  mesmasEquipes,
  prazoValido,
  resumoCronograma,
  situacaoNoRelatorio,
  urgencia,
  type VisitaParaCronograma,
} from "@/lib/cronograma";
import type { CronogramaCongelado, ItemCronograma } from "@/lib/types";

const item = (o: Partial<ItemCronograma> = {}): ItemCronograma => ({
  id: "i1", clienteId: "1", contratoId: "c1", unidadeId: "u1", equipeIds: ["medica"], tipo: "treinamento", prazo: "2026-11-20", horario: "", observacao: "", cancelado: false, ...o,
});
const visita = (o: Partial<VisitaParaCronograma> = {}): VisitaParaCronograma => ({
  contratoId: "c1", unidadeId: "u1", equipeIds: ["medica"], tipo: "treinamento", entrada: "2026-11-10T13:00:00.000Z", ...o,
});

test("sem visita, só o prazo decide: no prazo, a vencer e atrasado", () => {
  assert.equal(calcularSituacao(item(), [], "2026-11-01").situacao, "no_prazo");
  assert.equal(calcularSituacao(item(), [], "2026-11-12").situacao, "no_prazo"); // faltam 8 dias
  assert.equal(calcularSituacao(item(), [], "2026-11-13").situacao, "a_vencer"); // faltam 7 dias
  assert.equal(DIAS_A_VENCER, 7);
  assert.equal(calcularSituacao(item(), [], "2026-11-20").situacao, "a_vencer"); // no próprio dia ainda dá tempo
  assert.equal(calcularSituacao(item(), [], "2026-11-21").situacao, "atrasado");
  assert.equal(calcularSituacao(item(), [], "2026-11-21").diasParaPrazo, -1);
});

test("visita encerrada que bate com o item cumpre; depois do prazo, cumpre com atraso", () => {
  const r = calcularSituacao(item(), [visita()], "2026-11-25");
  assert.equal(r.situacao, "cumprido");
  assert.equal(r.cumpridoEm, "2026-11-10");
  assert.equal(calcularSituacao(item(), [visita({ entrada: "2026-11-22T13:00:00.000Z" })], "2026-11-25").situacao, "cumprido_com_atraso");
});

test("a visita precisa ter treinado todas as equipes do item (pode ter treinado outras também)", () => {
  const duas = item({ equipeIds: ["medica", "enfermagem"] });
  assert.equal(calcularSituacao(duas, [visita()], "2026-11-12").situacao, "no_prazo", "só a equipe médica não cumpre o item de médica e enfermagem");
  assert.equal(calcularSituacao(duas, [visita({ equipeIds: ["enfermagem", "medica"] })], "2026-11-12").situacao, "cumprido", "as duas, em qualquer ordem, cumprem");
  assert.equal(calcularSituacao(item(), [visita({ equipeIds: ["medica", "administrativa"] })], "2026-11-12").situacao, "cumprido", "treinar a mais não atrapalha");
  assert.equal(calcularSituacao(item(), [visita({ equipeIds: [] })], "2026-11-12").situacao, "no_prazo", "visita sem equipe marcada não cumpre item com equipe");
  assert.equal(calcularSituacao(item({ equipeIds: [] }), [visita({ equipeIds: [] })], "2026-11-12").situacao, "cumprido", "item sem equipe: qualquer visita do tipo cumpre");
  assert.equal(calcularSituacao(item(), [visita({ unidadeId: "u2" })], "2026-11-25").situacao, "atrasado", "outro estabelecimento não cumpre");
});

test("mesmas equipes ignora ordem e repetição; o texto do item mostra equipes, ou o setor nas versões antigas", () => {
  assert.equal(mesmasEquipes(["a", "b"], ["b", "a", "a"]), true);
  assert.equal(mesmasEquipes(["a"], ["a", "b"]), false);
  assert.equal(mesmasEquipes([], []), true);
  assert.equal(equipesDoItem({ equipes: ["Equipe médica", "Coordenação"] }), "Equipe médica, Coordenação");
  assert.equal(equipesDoItem({ equipes: [] }), "Todas as equipes");
  assert.equal(equipesDoItem({ equipeNomes: ["Coordenação"] }), "Coordenação");
  assert.equal(equipesDoItem({ setorNome: "Recepção" }), "Setor Recepção", "versão emitida antes das equipes");
  assert.equal(equipesDoItem({ setorNome: null }), "Todas as equipes");
});

test("itens iguais em dias diferentes: cada visita cumpre um só, o de prazo mais cedo", () => {
  const dias = ["2026-11-03", "2026-11-05", "2026-11-06"].map((prazo, n) => item({ id: `i${n}`, prazo }));
  const v = (dia: string, o: Partial<VisitaParaCronograma> = {}) => visita({ entrada: `${dia}T13:00:00.000Z`, ...o });

  const umaVisita = calcularSituacoes(dias, [v("2026-11-03")], "2026-11-04");
  assert.deepEqual(umaVisita.map((s) => s.situacao), ["cumprido", "a_vencer", "a_vencer"], "uma visita não cumpre os três dias");

  const duas = calcularSituacoes([dias[2], dias[0], dias[1]], [v("2026-11-05"), v("2026-11-03")], "2026-11-07");
  assert.deepEqual(duas.map((s) => [s.situacao, s.cumpridoEm]), [["atrasado", null], ["cumprido", "2026-11-03"], ["cumprido", "2026-11-05"]], "na ordem recebida; a visita mais antiga vai para o prazo mais cedo");

  const outroGrupo = item({ id: "coord", equipeIds: ["coordenacao"], prazo: "2026-11-03" });
  const ambos = calcularSituacoes([dias[0], outroGrupo], [v("2026-11-03", { equipeIds: ["medica", "coordenacao"] })], "2026-11-04");
  assert.deepEqual(ambos.map((s) => s.situacao), ["cumprido", "cumprido"], "itens com equipes diferentes podem usar a mesma visita");

  const comCancelado = calcularSituacoes([item({ id: "a", cancelado: true, prazo: "2026-11-01" }), dias[0]], [v("2026-11-03")], "2026-11-04");
  assert.deepEqual(comCancelado.map((s) => s.situacao), ["cancelado", "cumprido"], "item cancelado não gasta a visita");
});

test("o dia do prazo vale até o fim do dia em Brasília (23h30 de 20/11 = 21/11 em UTC)", () => {
  const tarde = visita({ entrada: "2026-11-21T02:30:00.000Z" });
  const r = calcularSituacao(item(), [tarde], "2026-11-25");
  assert.equal(r.cumpridoEm, "2026-11-20");
  assert.equal(r.situacao, "cumprido");
});

test("vale a primeira visita que bate", () => {
  const r = calcularSituacao(item(), [visita({ entrada: "2026-11-18T13:00:00.000Z" }), visita({ entrada: "2026-11-05T13:00:00.000Z" })], "2026-11-25");
  assert.equal(r.cumpridoEm, "2026-11-05");
});

test("outro estabelecimento, contrato ou tipo de visita não cumpre", () => {
  for (const v of [visita({ unidadeId: "u2" }), visita({ contratoId: "c2" }), visita({ tipo: "implantacao" }), visita({ tipo: "treinamento_online" })]) {
    assert.equal(calcularSituacao(item(), [v], "2026-11-12").situacao, "no_prazo");
  }
});

test("item cancelado não conta como pendente nem como cumprido", () => {
  const r = calcularSituacao(item({ cancelado: true }), [visita()], "2026-11-25");
  assert.equal(r.situacao, "cancelado");
  assert.equal(r.cumpridoEm, null);
  assert.equal(estaPendente("cancelado"), false);
  assert.equal(estaPendente("cumprido"), false);
  assert.equal(estaPendente("atrasado"), true);
});

test("prazo precisa ser uma data existente", () => {
  assert.equal(prazoValido("2026-11-20"), true);
  assert.equal(prazoValido("2026-02-30"), false);
  assert.equal(prazoValido("20/11/2026"), false);
  assert.equal(prazoValido(""), false);
  assert.equal(diasEntre("2026-11-01", "2026-12-01"), 30);
});

test("ordem de urgência e contagem", () => {
  assert.ok(urgencia("atrasado") < urgencia("a_vencer") && urgencia("a_vencer") < urgencia("no_prazo") && urgencia("no_prazo") < urgencia("cumprido"));
  const c = contarPorSituacao([{ situacao: "atrasado" }, { situacao: "atrasado" }, { situacao: "cumprido" }]);
  assert.equal(c.atrasado, 2);
  assert.equal(c.cumprido, 1);
  assert.equal(c.a_vencer, 0);
});

test("textos do prazo e resumo do relatório", () => {
  assert.equal(descreverPrazo(3), "faltam 3 dias");
  assert.equal(descreverPrazo(1), "faltam 1 dia");
  assert.equal(descreverPrazo(0), "vence hoje");
  assert.equal(descreverPrazo(-1), "venceu há 1 dia");
  assert.equal(descreverPrazo(-12), "venceu há 12 dias");

  const i = (situacao: CronogramaCongelado["itens"][number]["situacao"]) => ({ unidadeNome: "Sede", equipes: [], tipo: "treinamento" as const, prazo: "2026-11-20", situacao, cumpridoEm: null });
  assert.equal(resumoCronograma({ em: "2026-11-01", itens: [i("cumprido")] }), "1 de 1 item cumprido");
  assert.equal(resumoCronograma({ em: "2026-11-01", itens: [i("cumprido"), i("cumprido_com_atraso"), i("atrasado"), i("atrasado"), i("no_prazo")] }), "2 de 5 itens cumpridos");
  assert.equal(resumoCronograma({ em: "2026-11-01", itens: [i("a_vencer"), i("atrasado")] }), "0 de 2 itens cumpridos");
});

test("o cliente não lê atraso: cumprido com atraso vira Cumprido e atrasado vira Pendente", () => {
  assert.equal(ROTULO_SITUACAO_RELATORIO[situacaoNoRelatorio("cumprido_com_atraso")], "Cumprido");
  assert.equal(ROTULO_SITUACAO_RELATORIO[situacaoNoRelatorio("atrasado")], "Pendente");
  assert.equal(ROTULO_SITUACAO_RELATORIO[situacaoNoRelatorio("cumprido")], "Cumprido");
  assert.equal(ROTULO_SITUACAO_RELATORIO[situacaoNoRelatorio("a_vencer")], "A vencer");
  assert.equal(ROTULO_SITUACAO_RELATORIO[situacaoNoRelatorio("no_prazo")], "No prazo");
  for (const r of Object.values(ROTULO_SITUACAO_RELATORIO)) assert.doesNotMatch(r, /atras/i);
});
