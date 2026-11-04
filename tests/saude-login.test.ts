import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { SignJWT } from "jose";

process.env.SESSION_SECRET = "segredo-de-teste-local-com-bastante-texto-0123456789";
let L: typeof import("@/lib/saude-login");

// ---------- Configuração ----------

test("o login do participante vem desligado: precisa do endereço e do 'true' do tenant", () => {
  const url = "https://saude.exemplo.gov.br/api_parademinas/";
  assert.equal(L.prefixoDoTenant("saude_parademinas"), "SAUDE_API_SAUDE_PARADEMINAS");
  assert.equal(L.prefixoDoTenant("Saúde Pará-de-Minas"), "SAUDE_API_SAUDE_PARA_DE_MINAS");
  assert.equal(L.configLoginDoTenant("saude_parademinas", {}, true), null, "sem nada configurado");
  assert.equal(L.configLoginDoTenant("saude_parademinas", { SAUDE_API_SAUDE_PARADEMINAS_URL: url }, true), null, "só o endereço (a importação, por exemplo) não liga o login");
  assert.equal(L.configLoginDoTenant("saude_parademinas", { SAUDE_API_SAUDE_PARADEMINAS_LOGIN_PARTICIPANTE: "true" }, true), null, "ligado, mas sem endereço");
  assert.equal(L.configLoginDoTenant("saude_parademinas", { SAUDE_API_SAUDE_PARADEMINAS_URL: url, SAUDE_API_SAUDE_PARADEMINAS_LOGIN_PARTICIPANTE: "false" }, true), null);
  assert.deepEqual(L.configLoginDoTenant("saude_parademinas", { SAUDE_API_SAUDE_PARADEMINAS_URL: url, SAUDE_API_SAUDE_PARADEMINAS_LOGIN_PARTICIPANTE: " TRUE " }, true), { url: "https://saude.exemplo.gov.br/api_parademinas" }, "a barra do fim sai");
  assert.equal(L.configLoginDoTenant(null, { SAUDE_API__URL: url }, true), null, "cliente sem tenant");
});

test("o endereço aceita a forma do diretório de servidores do Saúde (com /api/ no fim) sem virar .../api/api/login", () => {
  const liga = (url: string) => L.configLoginDoTenant("t1", { SAUDE_API_T1_URL: url, SAUDE_API_T1_LOGIN_PARTICIPANTE: "true" }, true)?.url;
  assert.equal(liga("https://sidim.no-ip.net/api_parademinas"), "https://sidim.no-ip.net/api_parademinas");
  assert.equal(liga("https://sidim.no-ip.net/api_parademinas/"), "https://sidim.no-ip.net/api_parademinas");
  assert.equal(liga("https://sidim.no-ip.net/api_parademinas/api/"), "https://sidim.no-ip.net/api_parademinas", "como vem do diretório");
  assert.equal(liga("https://sidim.no-ip.net/api_parademinas/API"), "https://sidim.no-ip.net/api_parademinas");
  assert.equal(liga("https://sidim.no-ip.net/api_saude_lafaiete/api/"), "https://sidim.no-ip.net/api_saude_lafaiete", "o nome da pasta, que varia de cliente para cliente, não é mexido");
  assert.equal(L.enderecoBase("  "), undefined);
  assert.equal(L.enderecoBase(undefined), undefined);
});

test("em produção o login só liga com https://; em desenvolvimento, http:// também serve para testar", () => {
  const env = (url: string) => ({ SAUDE_API_T1_URL: url, SAUDE_API_T1_LOGIN_PARTICIPANTE: "true" });
  assert.equal(L.configLoginDoTenant("t1", env("http://sidim.no-ip.net/api_parademinas"), true), null, "http em produção: desligado");
  assert.deepEqual(L.configLoginDoTenant("t1", env("http://localhost:3999"), false), { url: "http://localhost:3999" }, "http fora de produção: liga");
  assert.deepEqual(L.configLoginDoTenant("t1", env("https://x.example/api"), true), { url: "https://x.example" }, "o /api do fim sai: o login é {endereço}/api/login");
  assert.equal(L.configLoginDoTenant("t1", env("ftp://x.example"), false), null);
  assert.equal(L.configLoginDoTenant("t1", env("isto não é endereço"), false), null);
  assert.equal(L.urlPermitida("https://x.example", true), true);
  assert.equal(L.urlPermitida("http://x.example", true), false);
});

test("o login é da pessoa escolhida só se o userId da API é o id do Saúde dela", () => {
  assert.equal(L.mesmaPessoa("62", "62"), true);
  assert.equal(L.mesmaPessoa(" 62 ", "62"), true);
  assert.equal(L.mesmaPessoa("62", "63"), false);
  assert.equal(L.mesmaPessoa("62", null), false, "participante sem id do Saúde não valida por login");
  assert.equal(L.mesmaPessoa("", ""), false);
});

// ---------- API falsa do Saúde ----------

let servidor: Server;
let base = "";
let chamadas: { metodo?: string; url?: string; tipo?: string; corpo: URLSearchParams }[] = [];
let modo: "normal" | "erro500" | "semuserid" | "naojson" | "userid-maiusculo" | "userid-texto" = "normal";

before(async () => {
  L = await import("@/lib/saude-login");
  servidor = createServer(async (req: IncomingMessage, res) => {
    let texto = "";
    for await (const parte of req) texto += parte;
    chamadas.push({ metodo: req.method, url: req.url, tipo: req.headers["content-type"], corpo: new URLSearchParams(texto) });
    const f = new URLSearchParams(texto);
    res.setHeader("Content-Type", "application/json");
    if (req.url !== "/api/login") {
      res.statusCode = 404;
      return res.end("{}");
    }
    if (modo === "erro500") {
      res.statusCode = 500;
      return res.end("{}");
    }
    if (modo === "naojson") return res.end("<html>oi</html>");
    if (f.get("username") === "maria" && f.get("password") === "s3nh@ certa") {
      if (modo === "semuserid") return res.end(JSON.stringify({ access_token: "x" }));
      if (modo === "userid-maiusculo") return res.end(JSON.stringify({ access_token: "x", UserId: 3001 }));
      if (modo === "userid-texto") return res.end(JSON.stringify({ access_token: "x", userId: "3001" }));
      return res.end(JSON.stringify({ access_token: "x", token_type: "bearer", userId: 3001 }));
    }
    res.statusCode = f.get("username") === "bloqueado" ? 403 : 400;
    res.end(JSON.stringify({ error: "invalid_grant" }));
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor?.close());

test("login certo: manda o formulário OAuth e devolve o userId (número ou texto, com qualquer caixa)", async () => {
  chamadas = [];
  modo = "normal";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "s3nh@ certa"), { ok: true, userId: "3001" });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].metodo, "POST");
  assert.equal(chamadas[0].url, "/api/login");
  assert.match(chamadas[0].tipo ?? "", /application\/x-www-form-urlencoded/);
  assert.equal(chamadas[0].corpo.get("grant_type"), "password");
  assert.equal(chamadas[0].corpo.get("username"), "maria");
  assert.equal(chamadas[0].corpo.get("password"), "s3nh@ certa", "a senha chega à API sem ser alterada (com espaço e símbolo)");
  modo = "userid-maiusculo";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "s3nh@ certa"), { ok: true, userId: "3001" });
  modo = "userid-texto";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "s3nh@ certa"), { ok: true, userId: "3001" });
});

test("login recusado pela API é 'credenciais'; API fora do ar ou fora do formato é 'indisponivel'", async () => {
  modo = "normal";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "errada"), { ok: false, motivo: "credenciais" }, "400 invalid_grant");
  assert.deepEqual(await L.loginNoSaude({ url: base }, "bloqueado", "x"), { ok: false, motivo: "credenciais" }, "403");
  modo = "erro500";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "s3nh@ certa"), { ok: false, motivo: "indisponivel" });
  modo = "naojson";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "s3nh@ certa"), { ok: false, motivo: "indisponivel" });
  modo = "semuserid";
  assert.deepEqual(await L.loginNoSaude({ url: base }, "maria", "s3nh@ certa"), { ok: false, motivo: "indisponivel" }, "sem userId não dá para validar quem é");
  assert.deepEqual(await L.loginNoSaude({ url: "http://127.0.0.1:1" }, "maria", "x"), { ok: false, motivo: "indisponivel" }, "ninguém ouvindo");
  modo = "normal";
});

// ---------- Prova ----------

test("a prova vale só para a finalidade, a visita e o participante para quem foi assinada", async () => {
  const prova = await L.assinarProva({ finalidade: "login_saude", visitaId: "v1", participanteId: "7" }, 10);
  assert.equal(await L.conferirProva(prova, { finalidade: "login_saude", visitaId: "v1", participanteId: "7" }), true);
  assert.equal(await L.conferirProva(prova, { finalidade: "login_saude", visitaId: "v2", participanteId: "7" }), false, "outra visita");
  assert.equal(await L.conferirProva(prova, { finalidade: "login_saude", visitaId: "v1", participanteId: "8" }), false, "outro participante");
  assert.equal(await L.conferirProva(prova, { finalidade: "sem_login", visitaId: "v1" }), false, "a prova do login não serve de 'sem login'");
  const tecnico = await L.assinarProva({ finalidade: "sem_login", visitaId: "v1" }, 30);
  assert.equal(await L.conferirProva(tecnico, { finalidade: "sem_login", visitaId: "v1" }), true);
  assert.equal(await L.conferirProva(tecnico, { finalidade: "login_saude", visitaId: "v1", participanteId: "7" }), false, "nem o contrário");
  assert.equal(await L.conferirProva(null, { finalidade: "sem_login", visitaId: "v1" }), false);
  assert.equal(await L.conferirProva("lixo", { finalidade: "sem_login", visitaId: "v1" }), false);
});

test("prova expirada, de outra chave ou sem a audiência (como o cookie de sessão) é recusada", async () => {
  const chave = new TextEncoder().encode(process.env.SESSION_SECRET);
  const expirada = await new SignJWT({ finalidade: "sem_login", visitaId: "v1" }).setProtectedHeader({ alg: "HS256" }).setAudience("presenca").setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(chave);
  assert.equal(await L.conferirProva(expirada, { finalidade: "sem_login", visitaId: "v1" }), false, "expirada");
  const outraChave = await new SignJWT({ finalidade: "sem_login", visitaId: "v1" }).setProtectedHeader({ alg: "HS256" }).setAudience("presenca").setExpirationTime("10m").sign(new TextEncoder().encode("outra-chave-qualquer-bem-grande-0123456789012345"));
  assert.equal(await L.conferirProva(outraChave, { finalidade: "sem_login", visitaId: "v1" }), false, "assinada por outra chave");
  const comoSessao = await new SignJWT({ userId: "1", finalidade: "sem_login", visitaId: "v1" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(chave);
  assert.equal(await L.conferirProva(comoSessao, { finalidade: "sem_login", visitaId: "v1" }), false, "token sem a audiência da presença");
});

// ---------- Limite de tentativas ----------

test("5 falhas bloqueiam a pessoa por 10 minutos; a visita aguenta 30; acertar zera a da pessoa", () => {
  const t0 = 1_000_000_000_000;
  for (let i = 0; i < 4; i++) L.registrarFalha("vA", "p1", t0 + i);
  assert.equal(L.bloqueadoPorFalhas("vA", "p1", t0 + 10), false, "4 falhas ainda passam");
  L.registrarFalha("vA", "p1", t0 + 5);
  assert.equal(L.bloqueadoPorFalhas("vA", "p1", t0 + 10), true, "5ª falha bloqueia");
  assert.equal(L.bloqueadoPorFalhas("vA", "p2", t0 + 10), false, "outra pessoa da mesma visita não é afetada");
  assert.equal(L.bloqueadoPorFalhas("vA", "p1", t0 + 10 * 60 * 1000 + 6), false, "passados 10 minutos, libera");
  L.limparFalhas("vA", "p1");
  assert.equal(L.bloqueadoPorFalhas("vA", "p1", t0 + 10), false, "acertar o login zera");

  for (let i = 0; i < L.MAX_FALHAS_VISITA; i++) L.registrarFalha("vB", `p${i}`, t0);
  assert.equal(L.bloqueadoPorFalhas("vB", "novo", t0 + 1), true, "30 falhas na visita travam todo mundo (tentativa de adivinhar)");
});
