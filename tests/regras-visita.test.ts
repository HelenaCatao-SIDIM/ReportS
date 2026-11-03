import assert from "node:assert/strict";
import { test } from "node:test";
import { equipesDaVisita, sugereTemasPorEquipe } from "@/lib/regras-visita";

const temas = [
  { id: "agendamento", sistema: "saude", ativo: true },
  { id: "prontuario-antigo", sistema: "saude", ativo: false },
  { id: "iptu", sistema: "serp", ativo: true },
];
const equipe = (id: string, temaIds: string[], ativo = true) => ({ id, nome: id, temaIds, ativo });

test("na visita só aparecem as equipes com tema mínimo ativo do sistema do contrato", () => {
  const equipes = [
    equipe("recepcao", ["agendamento"]),
    equipe("tributacao", ["iptu"]),
    equipe("mista", ["iptu", "agendamento"]),
    equipe("so-inativo", ["prontuario-antigo"]),
    equipe("inativa", ["agendamento"], false),
  ];
  assert.deepEqual(equipesDaVisita(equipes, temas, "saude", []).map((e) => e.id), ["recepcao", "mista"]);
  assert.deepEqual(equipesDaVisita(equipes, temas, "serp", []).map((e) => e.id), ["tributacao", "mista"]);
});

test("equipe já marcada continua na visita, mesmo inativada ou sem tema do sistema", () => {
  const equipes = [equipe("tributacao", ["iptu"]), equipe("inativa", ["agendamento"], false)];
  assert.deepEqual(equipesDaVisita(equipes, temas, "saude", ["tributacao", "inativa"]).map((e) => e.id), ["tributacao", "inativa"]);
});

test("só implantação e treinamentos registram equipes", () => {
  assert.deepEqual(
    (["implantacao", "treinamento", "treinamento_online", "suporte_presencial", "reuniao", "visita_tecnica"] as const).filter(sugereTemasPorEquipe),
    ["implantacao", "treinamento", "treinamento_online"],
  );
});
