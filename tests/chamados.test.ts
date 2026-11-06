import assert from "node:assert/strict";
import { test } from "node:test";
import { duracaoDoChamado, formatarTempo, indicadores, linhaDoAtendimento, minutosEntre, ordenarPorAbertura, partesDaData, tabulacoes } from "@/lib/chamados";
import type { ChamadoSuporte } from "@/lib/types";

const ch = (o: Partial<ChamadoSuporte> = {}): ChamadoSuporte => ({
  protocolo: "P1", abertura: "2026-10-05 09:10:00", encerramento: "2026-10-05 09:45:00", sistema: "SCA", topico: "Senha bloqueada", motivoEncerramento: "Problema de acesso", agente: "Rafael Moura", solicitante: "Marta Souza Lima", ...o,
});

test("datas do Fortics: texto com espaço ou com T e Z (o Z não é UTC)", () => {
  assert.deepEqual(partesDaData("2026-10-05 09:10:00"), { dia: "05/10/2026", data: "2026-10-05", hora: "09:10" });
  assert.deepEqual(partesDaData("2026-10-05T14:53:34.000000Z"), { dia: "05/10/2026", data: "2026-10-05", hora: "14:53" });
  assert.equal(partesDaData("lixo"), null);
  assert.equal(partesDaData(""), null);
});

test("tempo entre a abertura e o encerramento", () => {
  assert.equal(minutosEntre("2026-10-05 09:10:00", "2026-10-05 09:45:00"), 35);
  assert.equal(minutosEntre("2026-10-05T09:10:00.000000Z", "2026-10-06T08:15:00.000000Z"), 1385);
  assert.equal(minutosEntre("2026-10-05 10:00:00", "2026-10-05 09:00:00"), null, "encerramento antes da abertura");
  assert.equal(minutosEntre("2026-10-05 10:00:00", ""), null);
});

test("duração: a que o n8n mandou; sem ela, — (semTempo); só resumo antigo, sem a marca, usa encerramento menos abertura", () => {
  assert.equal(duracaoDoChamado(ch({ duracaoMin: 12 })), 12);
  assert.equal(duracaoDoChamado(ch({ duracaoMin: 0 })), 0);
  assert.equal(duracaoDoChamado(ch({ duracaoMin: null, semTempo: true })), null, "o n8n não trouxe o TMA: não se inventa o tempo");
  assert.equal(duracaoDoChamado(ch({ duracaoMin: 12, semTempo: true })), 12);
  // Resumos guardados antes de 06/11/2026 não têm a marca: o que já foi enviado continua igual.
  assert.equal(duracaoDoChamado(ch()), 35);
  assert.equal(duracaoDoChamado(ch({ duracaoMin: null })), 35);
  assert.equal(duracaoDoChamado(ch({ duracaoMin: -3 })), 35, "valor negativo é ignorado");
  assert.equal(duracaoDoChamado(ch({ encerramento: "" })), null);
});

test("formato dos tempos", () => {
  assert.equal(formatarTempo(9.3), "9,3 min");
  assert.equal(formatarTempo(22), "22 min");
  assert.equal(formatarTempo(0), "0 min");
  assert.equal(formatarTempo(65), "1h05min");
  assert.equal(formatarTempo(1188), "19h48min");
  assert.equal(formatarTempo(null), "—");
});

test("indicadores: atendimento médio e tempo total saem dos chamados que têm tempo", () => {
  const r = { totalAbertosEFechados: 3, tempoMedioEsperaMin: 9.3, chamados: [ch({ duracaoMin: 10 }), ch({ duracaoMin: 30 }), ch({ encerramento: "" })] };
  assert.deepEqual(indicadores(r), { total: 3, esperaMediaMin: 9.3, atendimentoMedioMin: 20, tempoTotalMin: 40 });
  const semTma = { ...r, chamados: [ch({ duracaoMin: 10 }), ch({ duracaoMin: 30 }), ch({ duracaoMin: null, semTempo: true })] };
  assert.deepEqual(indicadores(semTma), { total: 3, esperaMediaMin: 9.3, atendimentoMedioMin: 20, tempoTotalMin: 40 }, "o chamado sem TMA fica fora");
  assert.deepEqual(indicadores({ totalAbertosEFechados: 0, tempoMedioEsperaMin: null, chamados: [] }), { total: 0, esperaMediaMin: null, atendimentoMedioMin: null, tempoTotalMin: null });
});

test("por tabulação: as maiores, o resto em Outros, porcentagens e barras neutras", () => {
  const r = { totalAbertosEFechados: 54, porMotivoEncerramento: [{ nome: "Acesso", quantidade: 18 }, { nome: "Inatividade", quantidade: 12 }, { nome: "Não informado", quantidade: 3 }] };
  assert.deepEqual(tabulacoes(r), [
    { nome: "Acesso", quantidade: 18, percentual: 33, neutra: false },
    { nome: "Inatividade", quantidade: 12, percentual: 22, neutra: false },
    { nome: "Não informado", quantidade: 3, percentual: 6, neutra: true },
  ]);
  const muitas = { totalAbertosEFechados: 20, porMotivoEncerramento: Array.from({ length: 10 }, (_, i) => ({ nome: `T${i}`, quantidade: 2 })) };
  const t = tabulacoes(muitas, 4);
  assert.equal(t.length, 4);
  assert.deepEqual(t[3], { nome: "Outros", quantidade: 14, percentual: 70, neutra: true });
});

test("linha da lista analítica: sem protocolo, com — onde o Fortics não trouxe", () => {
  assert.deepEqual(linhaDoAtendimento(ch()), { dia: "05/10/2026", horario: "09:10 – 09:45", tempo: "35 min", solicitante: "Marta Souza Lima", tecnico: "Rafael Moura", assunto: "Senha bloqueada", tabulacao: "Problema de acesso" });
  const l = linhaDoAtendimento(ch({ solicitante: undefined, encerramento: "2026-10-06 08:15:00", agente: "" }));
  assert.equal(l.solicitante, "—");
  assert.equal(l.tecnico, "—");
  assert.equal(l.horario, "09:10 – 06/10 08:15");
  assert.ok(!("protocolo" in l));
  assert.equal(linhaDoAtendimento(ch({ duracaoMin: null, semTempo: true })).tempo, "—");
});

test("ordena do mais antigo ao mais recente sem mudar a lista original", () => {
  const a = ch({ protocolo: "A", abertura: "2026-10-07 10:00:00" });
  const b = ch({ protocolo: "B", abertura: "2026-10-05 11:00:00" });
  const c = ch({ protocolo: "C", abertura: "2026-10-05 09:00:00" });
  const original = [a, b, c];
  assert.deepEqual(ordenarPorAbertura(original).map((x) => x.protocolo), ["C", "B", "A"]);
  assert.deepEqual(original.map((x) => x.protocolo), ["A", "B", "C"]);
});
