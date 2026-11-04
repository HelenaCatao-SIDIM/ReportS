import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { ErroSaude, acessoDoTenant, buscarFuncionarios, lerFuncionario, lerFuncionarios, lerToken, prefixoDoTenant, type FuncionarioSaude } from "@/lib/saude-api";
import {
  contarParticipantes,
  estabelecimentosDosFuncionarios,
  planejarEstabelecimentos,
  planejarParticipantes,
  type ParticipanteExistente,
} from "@/lib/importacao-saude";

const CPF = "52998224725"; // válido
const CPF2 = "11144477735"; // válido

const func = (o: Partial<FuncionarioSaude> = {}): FuncionarioSaude => ({
  idFuncionario: "12", idUsuario: "34", usuarioAtivo: true, nome: "Maria Souza", cpf: CPF, cbos: ["225125"], estabelecimentos: [], ...o,
});
const pessoa = (o: Partial<ParticipanteExistente> = {}): ParticipanteExistente => ({
  id: "1", idErp: "34", estado: "confirmado", nome: "Maria Souza", cpf: null, cboCodigo: null, ...o,
});
const CBOS = new Map([["225125", { codigo: "225125", titulo: "Médico clínico" }]]);

// ---------- Configuração ----------

test("variáveis do tenant: maiúsculas e sem símbolos; faltando uma, não há acesso", () => {
  assert.equal(prefixoDoTenant("saude_parademinas"), "SAUDE_API_SAUDE_PARADEMINAS");
  assert.equal(prefixoDoTenant("Saúde-Pará de Minas"), "SAUDE_API_SAUDE_PARA_DE_MINAS");
  const env = { SAUDE_API_SAUDE_PARADEMINAS_URL: "https://saude.exemplo/ ", SAUDE_API_SAUDE_PARADEMINAS_USUARIO: "integracao", SAUDE_API_SAUDE_PARADEMINAS_SENHA: "x" };
  assert.deepEqual(acessoDoTenant("saude_parademinas", env), { url: "https://saude.exemplo", usuario: "integracao", senha: "x" });
  assert.equal(acessoDoTenant("saude_parademinas", { ...env, SAUDE_API_SAUDE_PARADEMINAS_SENHA: "" }), null);
  assert.equal(acessoDoTenant(null, env), null);
  assert.equal(acessoDoTenant("outro", env), null);
});

// ---------- Leitura da resposta ----------

test("lê o funcionário do exemplo da API, com usuário", () => {
  const f = lerFuncionario({ id: 12, nome: "Maria ...", usuarioId: 34, nomeUsuario: "maria", usuario: { id: 34, nome: "maria", ativo: true, funcionarioId: 12 } });
  assert.deepEqual(f, { idFuncionario: "12", idUsuario: "34", usuarioAtivo: true, nome: "Maria ...", cpf: null, cbos: [], estabelecimentos: [] });
});

test("lê o funcionário no formato da API de Pará de Minas: codigo, nome e idUsuario; usuario é o login e cargo não vira CBO", () => {
  const f = lerFuncionario({ codigo: 2, nome: "FULANA DE TAL", cargo: "cirurgião dentista", cns: "", municipio: "314710", usuario: "fulana", email: "", idUsuario: 62 });
  assert.deepEqual(f, { idFuncionario: "2", idUsuario: "62", usuarioAtivo: true, nome: "FULANA DE TAL", cpf: null, cbos: [], estabelecimentos: [] });
});

test("funcionário sem usuário vem com usuario: null; usuário inativo é marcado", () => {
  assert.equal(lerFuncionario({ id: 1, nome: "Ana", usuario: null })?.idUsuario, null);
  assert.equal(lerFuncionario({ id: 1, nome: "Ana", usuario: { id: 9, ativo: false } })?.usuarioAtivo, false);
});

test("CPF com máscara vira só dígitos; CBO e estabelecimento em formatos diferentes, sem repetir", () => {
  const f = lerFuncionario({
    Id: 5,
    Nome: "João",
    Cpf: "529.982.247-25",
    cbos: [{ codigo: "2251-25" }, { cbo: { codigo: "322205" } }, "225125", { codigo: "abc" }],
    estabelecimentos: [
      { estabelecimento: { id: 7, nome: "UPA 24h", logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Pará de Minas", uf: "MG" } },
      { id: 7, nome: "UPA 24h" },
      { id: 8, nomeFantasia: "AME" },
      { id: 9 },
    ],
  });
  assert.equal(f?.cpf, CPF);
  assert.deepEqual(f?.cbos, ["225125", "322205"]);
  assert.deepEqual(f?.estabelecimentos, [
    { idErp: "7", nome: "UPA 24h", endereco: "Rua A, 10 — Centro — Pará de Minas/MG" },
    { idErp: "8", nome: "AME", endereco: "" },
  ]);
});

test("sem id ou sem nome, o funcionário é ignorado; resposta que não é lista é formato inesperado", () => {
  assert.deepEqual(lerFuncionarios([{ id: 1 }, { nome: "x" }, null, { id: 2, nome: "Ok" }])?.map((f) => f.idFuncionario), ["2"]);
  assert.equal(lerFuncionarios({ erro: "x" }), undefined);
});

test("token do login: access_token (OAuth), direto ou dentro do usuário", () => {
  assert.equal(lerToken({ access_token: "oauth", token_type: "bearer", userId: 62 }), "oauth");
  assert.equal(lerToken({ token: "abc" }), "abc");
  assert.equal(lerToken({ id: 1, nome: "x", usuario: { token: "def" } }), "def");
  assert.equal(lerToken({ id: 1 }), null);
});

// ---------- Estabelecimentos ----------

test("estabelecimentos: liga pelo id do ERP, casa pelo nome sem acento uma vez só e cria o resto", () => {
  const vindos = estabelecimentosDosFuncionarios([
    func({ estabelecimentos: [{ idErp: "7", nome: "UPA 24h", endereco: "Rua A" }, { idErp: "8", nome: "AME", endereco: "" }] }),
    func({ estabelecimentos: [{ idErp: "7", nome: "UPA 24h", endereco: "Rua A" }, { idErp: "9", nome: "Almoxarifado", endereco: "" }, { idErp: "10", nome: "Almoxarifado", endereco: "" }] }),
  ]);
  assert.equal(vindos.length, 4);
  const plano = planejarEstabelecimentos(
    [
      { id: "u1", nome: "UPA 24h", endereco: "", idErp: "7" },
      { id: "u2", nome: "almoxarifado", endereco: "Rua B", idErp: null },
    ],
    vindos,
  );
  assert.deepEqual(plano, [
    { acao: "atualizar", id: "u1", endereco: "Rua A" }, // ligado e com endereço vazio no ReportS
    { acao: "criar", idErp: "8", nome: "AME", endereco: "" },
    { acao: "ligar", id: "u2", idErp: "9", endereco: undefined }, // endereço do ReportS fica
    { acao: "criar", idErp: "10", nome: "Almoxarifado", endereco: "" }, // u2 já foi casado
  ]);
});

test("estabelecimento já ligado e com endereço não muda", () => {
  assert.deepEqual(planejarEstabelecimentos([{ id: "u1", nome: "Outro nome", endereco: "Rua X", idErp: "7" }], [{ idErp: "7", nome: "UPA", endereco: "Rua A" }]), [
    { acao: "manter", id: "u1" },
  ]);
});

// ---------- Profissionais ----------

test("cria confirmado novo com CPF válido e o primeiro CBO da tabela oficial", () => {
  const [p] = planejarParticipantes([], [func({ cbos: ["999999", "225125"] })], CBOS);
  assert.deepEqual(p, { acao: "criar", idUsuario: "34", nome: "Maria Souza", cpf: CPF, cbo: { codigo: "225125", titulo: "Médico clínico" }, cpfEmUso: false, parecidoCom: null });
});

test("sem usuário, usuário inativo, usuário repetido e já unido ficam de fora", () => {
  const plano = planejarParticipantes(
    [pessoa({ idErp: "50", estado: "unido" })],
    [func({ idUsuario: null }), func({ usuarioAtivo: false }), func({ idUsuario: "40" }), func({ idUsuario: "40", cpf: CPF2 }), func({ idUsuario: "50" })],
    CBOS,
  );
  assert.deepEqual(
    plano.map((p) => (p.acao === "ignorar" ? p.motivo : p.acao)),
    ["sem_usuario", "usuario_inativo", "criar", "repetido", "unido"],
  );
  const c = contarParticipantes(plano);
  assert.equal(c.participantes.semUsuario, 1);
  assert.equal(c.participantes.usuarioInativo, 1);
});

test("confirmado que já existe: preenche só CPF e CBO vazios, nunca troca", () => {
  assert.deepEqual(planejarParticipantes([pessoa()], [func()], CBOS), [{ acao: "atualizar", id: "1", cpf: CPF, cbo: { codigo: "225125", titulo: "Médico clínico" } }]);
  assert.deepEqual(planejarParticipantes([pessoa({ cpf: CPF2, cboCodigo: "322205" })], [func()], CBOS), [{ acao: "manter", id: "1" }]);
});

test("CPF de outro participante: o novo entra sem CPF e aparece no resumo; CPF inválido é descartado", () => {
  const plano = planejarParticipantes([pessoa({ id: "9", idErp: null, estado: "provisorio", nome: "Fulano", cpf: CPF })], [func(), func({ idUsuario: "35", nome: "Ana", cpf: "12345678900" })], CBOS);
  assert.equal(plano[0].acao === "criar" && plano[0].cpf, null);
  assert.equal(plano[1].acao === "criar" && plano[1].cpf, null);
  assert.deepEqual(contarParticipantes(plano).cpfEmUso, ["Maria Souza"]);
});

test("dois funcionários com o mesmo CPF: só o primeiro fica com ele", () => {
  const plano = planejarParticipantes([], [func(), func({ idUsuario: "35", nome: "Outra" })], CBOS);
  assert.deepEqual(contarParticipantes(plano).cpfEmUso, ["Outra"]);
});

test("nome parecido com um provisório vira aviso de possível duplicado", () => {
  const plano = planejarParticipantes([pessoa({ id: "9", idErp: null, estado: "provisorio", nome: "Maria de Souza" })], [func({ cpf: null })], CBOS);
  assert.deepEqual(contarParticipantes(plano).parecidos, ["Maria Souza ≈ Maria de Souza"]);
});

// ---------- Chamadas (API falsa local) ----------

/**
 * API falsa no formato da de Pará de Minas: login OAuth por formulário (usuário "integracao"/"x") e /api/funcionario
 * com 3 funcionários, nos campos que a API real devolve.
 */
async function comApiFalsa(fn: (url: string, pedidos: string[]) => Promise<void>, { semPermissao = false } = {}) {
  const pedidos: string[] = [];
  const servidor = createServer((req, res) => {
    pedidos.push(`${req.method} ${req.url}`);
    if (req.url === "/api/login") {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        const f = new URLSearchParams(corpo);
        if (f.get("grant_type") !== "password" || f.get("username") !== "integracao" || f.get("password") !== "x") {
          return res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid_grant", error_description: "Usuário ou senha informados estão incorretos" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ access_token: "tk", token_type: "bearer", expires_in: 100, userId: 62, idFuncionario: 2, Username: "integracao" }));
      });
      return;
    }
    if (req.url !== "/api/funcionario" || req.headers.authorization !== "Bearer tk") return res.writeHead(404).end();
    if (semPermissao) return res.writeHead(403).end();
    const itens = [1, 2, 3].map((i) => ({ codigo: i, nome: `PESSOA ${i}`, cargo: "cirurgião dentista", cns: "", municipio: "314710", usuario: `p${i}`, email: "", idUsuario: 60 + i }));
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(itens));
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  try {
    await fn(`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`, pedidos);
  } finally {
    servidor.close();
  }
}

test("entra por formulário e busca os funcionários com o access_token", async () => {
  await comApiFalsa(async (url, pedidos) => {
    const lista = await buscarFuncionarios({ url, usuario: "integracao", senha: "x" });
    assert.deepEqual(pedidos, ["POST /api/login", "GET /api/funcionario"]);
    assert.equal(lista.length, 3);
    assert.deepEqual(lista[0], { idFuncionario: "1", idUsuario: "61", usuarioAtivo: true, nome: "PESSOA 1", cpf: null, cbos: [], estabelecimentos: [] });
  });
});

test("login recusado e falta de permissão viram mensagens claras", async () => {
  await comApiFalsa(async (url) => {
    await assert.rejects(buscarFuncionarios({ url, usuario: "integracao", senha: "errada" }), (e) => e instanceof ErroSaude && /recusou o login/.test(e.message));
  });
  await comApiFalsa(
    async (url) => {
      await assert.rejects(buscarFuncionarios({ url, usuario: "integracao", senha: "x" }), (e) => e instanceof ErroSaude && /não tem permissão/.test(e.message));
    },
    { semPermissao: true },
  );
});

test("API fora do ar vira mensagem clara", async () => {
  await assert.rejects(buscarFuncionarios({ url: "http://127.0.0.1:9", usuario: "a", senha: "b" }), (e) => e instanceof ErroSaude && /não respondeu/.test(e.message));
});
