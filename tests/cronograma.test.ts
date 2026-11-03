import assert from "node:assert/strict";
import { test } from "node:test";
import { DIAS_A_VENCER, calcularSituacao, contarPorSituacao, diasEntre, estaPendente, prazoValido, urgencia, type VisitaParaCronograma } from "@/lib/cronograma";
import type { ItemCronograma } from "@/lib/types";

const item = (o: Partial<ItemCronograma> = {}): ItemCronograma => ({
  id: "i1", clienteId: "1", contratoId: "c1", unidadeId: "u1", setorId: "s1", tipo: "treinamento", prazo: "2026-11-20", observacao: "", cancelado: false, ...o,
});
const visita = (o: Partial<VisitaParaCronograma> = {}): VisitaParaCronograma => ({
  contratoId: "c1", unidadeId: "u1", setorId: "s1", tipo: "treinamento", entrada: "2026-11-10T13:00:00.000Z", ...o,
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

test("item com setor exige o mesmo setor; sem setor, qualquer setor do estabelecimento serve", () => {
  assert.equal(calcularSituacao(item(), [visita({ setorId: "s2" })], "2026-11-12").situacao, "no_prazo");
  assert.equal(calcularSituacao(item(), [visita({ setorId: null })], "2026-11-12").situacao, "no_prazo"); // setor digitado à mão não é o setor do item
  assert.equal(calcularSituacao(item({ setorId: null }), [visita({ setorId: "s2" })], "2026-11-12").situacao, "cumprido");
  assert.equal(calcularSituacao(item({ setorId: null }), [visita({ setorId: null })], "2026-11-12").situacao, "cumprido");
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
