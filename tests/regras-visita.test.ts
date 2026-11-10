import assert from "node:assert/strict";
import { test } from "node:test";
import { abrePelaPresenca, equipesDaVisita, podeMostrarDonoDoCpf, rotaDaVisita, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { nomesDosSetores, rotuloAtendidos, tituloAtendidos } from "@/lib/visitas";

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

test("os setores da visita: o do check-in e os acrescentados, sem repetir (nem acento ou caixa) e sem o traço de quem não tem setor", () => {
  assert.deepEqual(nomesDosSetores({ setorNome: "Protocolo", setoresExtras: [{ nome: "Recursos Humanos" }, { nome: "protocolo" }, { nome: "Recursos HUMANOS" }] }), ["Protocolo", "Recursos Humanos"]);
  assert.equal(rotuloAtendidos({ setorNome: "Protocolo", setoresExtras: [{ nome: "Tributação" }, { nome: "Farmácia" }] }), "Protocolo, Tributação, Farmácia");
  assert.equal(rotuloAtendidos({ setorNome: "—", setoresExtras: [{ nome: "Farmácia" }] }), "Farmácia", "sem setor no check-in, só os acrescentados");
  assert.equal(rotuloAtendidos({ setorNome: "—" }), "—", "versões antigas de relatório não têm a lista de setores acrescentados");
  assert.equal(rotuloAtendidos({ setorNome: "Protocolo" }), "Protocolo");
  assert.equal(rotuloAtendidos({ setorNome: "—", equipes: ["Médica", "Enfermagem"] }), "Médica, Enfermagem", "visita nova: as equipes no lugar do setor");
  assert.equal(rotuloAtendidos({ setorNome: "Protocolo", equipes: ["Médica"] }), "Protocolo", "visita antiga continua mostrando o setor");
  assert.equal(rotuloAtendidos({ setorNome: "—", equipes: [] }), "—");
  assert.equal(tituloAtendidos({ setorNome: "Protocolo" }), "Setor");
  assert.equal(tituloAtendidos({ setorNome: "Protocolo", setoresExtras: [{ nome: "Farmácia" }] }), "Setores");
  assert.equal(tituloAtendidos({ setorNome: "—" }), "Equipes");
});

test("a visita abre pela presença nos tipos com participantes, e a tela da visita só depois de alguém assinar", () => {
  for (const t of ["treinamento", "treinamento_online", "implantacao"] as const) assert.equal(abrePelaPresenca(t), true, t);
  for (const t of ["suporte_presencial", "reuniao", "visita_tecnica"] as const) assert.equal(abrePelaPresenca(t), false, t);
  assert.equal(rotaDaVisita({ id: "v1", tipo: "treinamento", presencas: [] }), "/tecnico/visita/v1/presenca");
  assert.equal(rotaDaVisita({ id: "v1", tipo: "treinamento", presencas: [{}] }), "/tecnico/visita/v1", "já houve assinatura: vai para temas e anotações");
  assert.equal(rotaDaVisita({ id: "v2", tipo: "reuniao", presencas: [] }), "/tecnico/visita/v2", "tipos sem participantes abrem direto na visita");
});

test("CPF que já é de alguém: o nome do dono só aparece se for parecido com o de quem assina (a tela passa de mão em mão)", () => {
  assert.equal(podeMostrarDonoDoCpf("Luciana Ferraz", "Luciana Ferraz"), true, "mesmo nome: provavelmente a mesma pessoa");
  assert.equal(podeMostrarDonoDoCpf("Luciana Ferraz", "LUCIANA FERRAZ"), true, "sem diferenciar caixa");
  assert.equal(podeMostrarDonoDoCpf("Luciana Ferraz", "Luciana Ferrraz"), true, "erro de digitação");
  assert.equal(podeMostrarDonoDoCpf("Luciana Ferraz", "Rogério Batista"), false, "outra pessoa: o nome não é revelado");
  assert.equal(podeMostrarDonoDoCpf("Maria", "Patrícia Gomes"), false);
});
