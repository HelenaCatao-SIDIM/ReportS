import assert from "node:assert/strict";
import { test } from "node:test";
import { duracaoDoChamado, indicadores, linhaDoAtendimento } from "@/lib/chamados";
import { lerResposta } from "@/lib/suporte";

const base = { totalAbertosEFechados: 1, porSistema: [{ nome: "SCA", quantidade: 1 }], porTopico: [{ nome: "Senha", quantidade: 1 }], porMotivoEncerramento: [{ nome: "Resolvido", quantidade: 1 }] };
const chamado = { protocolo: "P1", abertura: "2026-10-05 09:10:00", encerramento: "2026-10-05 09:45:00", sistema: "SCA", topico: "Senha", motivoEncerramento: "Resolvido", agente: "Rafael Moura", solicitante: "Marta Souza Lima" };

test("o tempo do atendimento vem de tempoAtendimentoMin (fluxo atual do n8n) ou de duracaoMin (formato antigo)", () => {
  const atual = lerResposta({ ...base, chamados: [{ ...chamado, tempoAtendimentoMin: 12.5 }] });
  assert.equal(atual?.chamados[0].duracaoMin, 12.5);
  assert.equal(duracaoDoChamado(atual!.chamados[0]), 12.5, "vale o tempo real, não o encerramento menos a abertura (35)");

  const antigo = lerResposta({ ...base, chamados: [{ ...chamado, duracaoMin: 20 }] });
  assert.equal(antigo?.chamados[0].duracaoMin, 20);

  const ambos = lerResposta({ ...base, chamados: [{ ...chamado, duracaoMin: 20, tempoAtendimentoMin: 12.5 }] });
  assert.equal(ambos?.chamados[0].duracaoMin, 20, "o campo antigo, se vier, continua valendo");
});

test("chamado sem TMA (ausente, nulo ou inválido) fica sem tempo: aparece como — e não entra na média", () => {
  for (const extra of [{}, { tempoAtendimentoMin: null }, { tempoAtendimentoMin: -4 }, { tempoAtendimentoMin: "12" }]) {
    const r = lerResposta({ ...base, chamados: [{ ...chamado, ...extra }] });
    assert.equal(r?.chamados[0].duracaoMin, null);
    assert.equal(r?.chamados[0].semTempo, true);
    assert.equal(duracaoDoChamado(r!.chamados[0]), null, "não usa o encerramento menos a abertura (35), que inclui a espera");
    assert.equal(linhaDoAtendimento(r!.chamados[0]).tempo, "—");
  }
  const comTempo = lerResposta({ ...base, chamados: [{ ...chamado, tempoAtendimentoMin: 0 }] });
  assert.equal(comTempo?.chamados[0].duracaoMin, 0, "zero é um tempo válido");
  assert.equal(comTempo?.chamados[0].semTempo, undefined);
});

test("atendimento médio e tempo total ignoram os chamados sem TMA", () => {
  const r = lerResposta({ ...base, totalAbertosEFechados: 3, chamados: [{ ...chamado, tempoAtendimentoMin: 10 }, { ...chamado, protocolo: "P2", tempoAtendimentoMin: 30 }, { ...chamado, protocolo: "P3", tempoAtendimentoMin: null }] });
  assert.deepEqual(indicadores({ totalAbertosEFechados: 3, tempoMedioEsperaMin: null, chamados: r!.chamados }), { total: 3, esperaMediaMin: null, atendimentoMedioMin: 20, tempoTotalMin: 40 });
});

test("campos a mais do fluxo atual (tabulação, espera, TMA médio) são ignorados sem quebrar a leitura", () => {
  const r = lerResposta({
    ...base,
    periodo: { inicio: "2026-10-01", fim: "2026-10-31" },
    porTabulacao: [{ nome: "Resolvido", quantidade: 1 }],
    tempoMedioEsperaMin: 3.2,
    tempoMedioAtendimentoMin: 12.5,
    chamados: [{ ...chamado, abertura: "2026-10-05 09:10:00", tabulacao: "Resolvido", tempoEsperaMin: 3.2, tempoAtendimentoMin: 12.5 }],
  });
  assert.ok(r);
  assert.equal(r.tempoMedioEsperaMin, 3.2);
  assert.equal(r.chamados[0].solicitante, "Marta Souza Lima");
  assert.equal(r.chamados[0].motivoEncerramento, "Resolvido");
});

test("resposta fora do formato é recusada", () => {
  assert.equal(lerResposta(null), null);
  assert.equal(lerResposta({ ...base, totalAbertosEFechados: -1 }), null);
  assert.equal(lerResposta({ ...base, porSistema: "x" }), null);
});
