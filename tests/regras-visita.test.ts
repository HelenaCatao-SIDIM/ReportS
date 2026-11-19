import assert from "node:assert/strict";
import { test } from "node:test";
import { abrePelaPresenca, equipesDaVisita, exigeAssinaturaNaPresenca, exigeLoginNaPresenca, podeMostrarDonoDoCpf, rotaDaVisita, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { rotuloAtendidos, tituloAtendidos } from "@/lib/visitas";

const equipe = (id: string, temaIds: string[], ativo = true) => ({ id, nome: id, temaIds, ativo });

test("no check-in e na visita aparecem todas as equipes ativas, com ou sem tema mínimo", () => {
  const equipes = [
    equipe("recepcao", ["agendamento"]),
    equipe("tributacao", ["iptu"]),
    equipe("mista", ["iptu", "agendamento"]),
    equipe("so-inativo", ["prontuario-antigo"]),
    equipe("inativa", ["agendamento"], false),
  ];
  assert.deepEqual(equipesDaVisita(equipes, []).map((e) => e.id), equipes.filter((e) => e.ativo).map((e) => e.id));
});

test("equipe já marcada continua na visita, mesmo inativada", () => {
  const equipes = [equipe("tributacao", ["iptu"]), equipe("inativa", ["agendamento"], false)];
  assert.deepEqual(equipesDaVisita(equipes, ["tributacao", "inativa"]).map((e) => e.id), ["tributacao", "inativa"]);
});

test("só implantação e treinamentos registram equipes", () => {
  assert.deepEqual(
    (["implantacao", "treinamento", "treinamento_online", "suporte_presencial", "reuniao", "visita_tecnica"] as const).filter(sugereTemasPorEquipe),
    ["implantacao", "treinamento", "treinamento_online"],
  );
});

test("quem a visita atendeu: as equipes treinadas", () => {
  assert.equal(rotuloAtendidos({ equipes: ["Médica", "Enfermagem"] }), "Médica, Enfermagem");
  assert.equal(rotuloAtendidos({ equipes: [] }), "—");
  assert.equal(rotuloAtendidos({}), "—", "versões antigas de relatório não têm equipes");
  assert.equal(tituloAtendidos(), "Equipes");
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

test("assinatura na presença: só em contrato assinado, visita presencial e fora da análise de ambiente", () => {
  assert.equal(exigeAssinaturaNaPresenca("assinado", "treinamento"), true);
  assert.equal(exigeAssinaturaNaPresenca("assinado", "visita_tecnica"), true);
  assert.equal(exigeAssinaturaNaPresenca("assinado", "analise_ambiente"), false, "análise de ambiente não exige assinatura");
  assert.equal(exigeAssinaturaNaPresenca("assinado", "treinamento_online"), false, "online é sempre nominal");
  assert.equal(exigeAssinaturaNaPresenca("nominal", "treinamento"), false);
  assert.equal(exigeAssinaturaNaPresenca(undefined, "treinamento"), false);
  // Login é o nível, não assinatura: um exclui o outro.
  assert.equal(exigeAssinaturaNaPresenca("login", "treinamento"), false, "contrato login não pede assinatura");
});

test("login na presença: só em contrato login, visita presencial e fora da análise de ambiente", () => {
  assert.equal(exigeLoginNaPresenca("login", "treinamento"), true);
  assert.equal(exigeLoginNaPresenca("login", "visita_tecnica"), true);
  assert.equal(exigeLoginNaPresenca("login", "analise_ambiente"), false, "análise de ambiente não exige login");
  assert.equal(exigeLoginNaPresenca("login", "treinamento_online"), false, "online é sempre nominal");
  assert.equal(exigeLoginNaPresenca("assinado", "treinamento"), false, "contrato assinado não pede login");
  assert.equal(exigeLoginNaPresenca("nominal", "treinamento"), false);
  assert.equal(exigeLoginNaPresenca(undefined, "treinamento"), false);
  // Nunca os dois ao mesmo tempo: o contrato marca um nível só.
  const niveis = ["nominal", "assinado", "login"] as const;
  for (const n of niveis) assert.equal(exigeAssinaturaNaPresenca(n, "treinamento") && exigeLoginNaPresenca(n, "treinamento"), false, "assinatura e login nunca juntos");
});
