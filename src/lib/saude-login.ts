import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { normalizar } from "@/lib/format";

/*
 * Login do participante no SIDIM Saúde, para validar a presença na tela de presença (antes da assinatura).
 *
 * A pessoa digita o usuário e a senha dela no Saúde; o ReportS só repassa à API do tenant (POST /api/login) e compara o
 * `userId` que a API devolve com o id do Saúde do participante escolhido (`client_users.external_user_id`). A senha passa
 * só pela memória: nunca é gravada, registrada em log nem enviada ao navegador de volta. O que sobra é uma "prova"
 * assinada de curta duração, que a ação de presença confere (o navegador nunca decide sozinho que o login passou).
 *
 * Sempre ligado, para todos os clientes do Saúde que estão no diretório (sem chave de ligar nem configuração por cliente).
 * O endereço da API de cada cliente vem do diretório de servidores do Saúde da SIDIM:
 *   o tenant do sistema do cliente (ex.: saude_parademinas) é comparado com a pasta da logo de cada servidor
 *   (".../saude_parademinas/Imagens/Logo_Prefeitura.png", a pasta antes de /Imagens/, em qualquer host); o servidor
 *   que bater, e só um, dá o endereço da API ("endereco").
 * A senha viaja até a API, e o diretório decide para onde: os dois são chamados **em https://**. O diretório publica a
 * maioria dos endereços como http://, mas as APIs respondem em https:// no mesmo endereço: o http:// vira https://.
 * Cliente não encontrado no diretório (ou encontrado mais de uma vez) fica sem o login, com a presença de antes.
 */

/** Diretório de servidores do Saúde da SIDIM: [{ idServidor, descricao, endereco, imagem }]. */
export const DIRETORIO_PADRAO = "https://sidim.no-ip.net/servidores_saude/api/servidorsaude";

/** Em produção só https://; fora dela, também http:// (para testar com uma API de desenvolvimento). */
export function urlPermitida(url: string, producao: boolean): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && !producao);
  } catch {
    return false;
  }
}

export interface ConfigLogin {
  url: string;
}

const avisados = new Set<string>();

/**
 * Endereço da API do tenant sem a barra do fim e sem o "/api" final. O diretório de servidores do Saúde publica o endereço com
 * "/api/" no fim (ex.: .../api_parademinas/api/) e o login é "{endereço}/api/login": quem copiar o endereço do diretório não
 * pode acabar chamando ".../api/api/login".
 */
export function enderecoBase(valor: string | undefined): string | undefined {
  const url = valor?.trim().replace(/\/+$/, "").replace(/\/api$/i, "").replace(/\/+$/, "");
  return url || undefined;
}

const avisar = (chave: string, mensagem: string) => {
  if (avisados.has(chave)) return;
  avisados.add(chave);
  console.warn(`[saude-login] ${mensagem}`);
};

/**
 * http:// vira https:// (as APIs do Saúde respondem nos dois no mesmo endereço, e a senha não pode ir aberta). Fora de
 * produção, um endereço local (localhost, 127.0.0.1) fica como está, para testar com uma API falsa.
 */
export function emHttps(url: string, producao: boolean): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return u.toString();
    if (u.protocol !== "http:") return null;
    if (!producao && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.toString();
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

/** Pasta da logo do servidor: a que vem antes de /Imagens/, em qualquer host (".../saude_florestal/Imagens/x.png" → "saude_florestal"). */
export function pastaDaImagem(imagem: unknown): string | null {
  if (typeof imagem !== "string" || !imagem.trim()) return null;
  try {
    const partes = new URL(imagem.trim()).pathname.split("/").filter(Boolean);
    const i = partes.findIndex((p) => p.toLowerCase() === "imagens");
    return i > 0 ? normalizar(decodeURIComponent(partes[i - 1])) : null;
  } catch {
    return null;
  }
}

export interface ServidorSaude {
  endereco: string;
  pasta: string | null;
}

/** A lista do diretório. `undefined` = a resposta não é uma lista (formato inesperado). */
export function lerServidores(json: unknown): ServidorSaude[] | undefined {
  if (!Array.isArray(json)) return undefined;
  return json.flatMap((item): ServidorSaude[] => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const endereco = typeof o.endereco === "string" ? o.endereco.trim() : "";
    return endereco ? [{ endereco, pasta: pastaDaImagem(o.imagem) }] : [];
  });
}

/** Endereço da API do tenant no diretório, já em https:// e sem o /api do fim. Null se não achar, ou se achar mais de um. */
export function enderecoDoTenant(servidores: ServidorSaude[], tenant: string, producao: boolean): string | null {
  const alvo = normalizar(tenant);
  const achados = servidores.filter((s) => s.pasta === alvo);
  if (achados.length !== 1) {
    if (achados.length > 1) avisar(`dup:${alvo}`, `o tenant ${tenant} aparece em ${achados.length} servidores do diretório: o login do participante fica desligado nele.`);
    return null;
  }
  const url = emHttps(achados[0].endereco, producao);
  const base = url ? enderecoBase(url) : undefined;
  return base && urlPermitida(base, producao) ? base : null;
}

// ---------- Diretório de servidores ----------

/** A lista muda pouco: guardada por 10 minutos. Se o diretório falhar, vale a última lista boa. */
const VALIDADE_MS = 10 * 60_000;
const g = globalThis as unknown as { __diretorioSaude?: { url: string; em: number; servidores: ServidorSaude[] } };

export function limparDiretorioGuardado() {
  g.__diretorioSaude = undefined;
}

async function servidoresDoDiretorio(diretorio: string, producao: boolean, agora = Date.now()): Promise<ServidorSaude[] | null> {
  const url = emHttps(diretorio, producao);
  if (!url || !urlPermitida(url, producao)) return null;
  const guardado = g.__diretorioSaude?.url === url ? g.__diretorioSaude : undefined;
  if (guardado && agora - guardado.em < VALIDADE_MS) return guardado.servidores;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store", redirect: "error" });
    const servidores = r.ok ? lerServidores(await r.json().catch(() => undefined)) : undefined;
    if (servidores) {
      g.__diretorioSaude = { url, em: agora, servidores };
      return servidores;
    }
  } catch {
    // cai na última lista boa, abaixo
  }
  avisar(`diretorio-falha:${Math.floor(agora / VALIDADE_MS)}`, "o diretório de servidores do Saúde não respondeu: valendo a última lista boa, se houver.");
  return guardado?.servidores ?? null;
}

/**
 * Endereço da API do Saúde do tenant, tirado do diretório de servidores (em https:// e sem o /api do fim). Null se o tenant
 * estiver vazio ou não estiver no diretório. Serve ao login do participante e à busca de estabelecimentos.
 */
export async function enderecoApiDoTenant(
  tenant: string | null,
  diretorio: string = DIRETORIO_PADRAO,
  producao: boolean = process.env.NODE_ENV === "production",
): Promise<string | null> {
  if (!tenant?.trim()) return null;
  const servidores = await servidoresDoDiretorio(diretorio, producao);
  return servidores ? enderecoDoTenant(servidores, tenant, producao) : null;
}

/**
 * Configuração do login do participante no tenant. Sempre ligado: null só quando o cliente não tem tenant ou o tenant não
 * está no diretório (aí a presença é a de antes, sem login). `diretorio` só muda nos testes.
 */
export async function configLoginDoTenant(
  tenant: string | null,
  diretorio: string = DIRETORIO_PADRAO,
  producao: boolean = process.env.NODE_ENV === "production",
): Promise<ConfigLogin | null> {
  const url = await enderecoApiDoTenant(tenant, diretorio, producao);
  return url ? { url } : null;
}

// ---------- Login na API ----------

export type ResultadoLogin = { ok: true; userId: string } | { ok: false; motivo: "credenciais" | "indisponivel" };

const TIMEOUT_MS = 15_000;

/** `userId` da resposta do login, venha como número ou texto, com qualquer caixa no nome do campo. */
function lerUserId(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return null;
  const o = corpo as Record<string, unknown>;
  const chave = Object.keys(o).find((k) => k.toLowerCase() === "userid");
  const v = chave === undefined ? undefined : o[chave];
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Entra no Saúde com o usuário e a senha da pessoa. "credenciais" = a API recusou o par (400, 401 ou 403); "indisponivel" =
 * a API não respondeu, respondeu erro ou veio num formato que não dá para validar. Nada do que a pessoa digitou é registrado.
 */
export async function loginNoSaude(cfg: ConfigLogin, usuario: string, senha: string): Promise<ResultadoLogin> {
  try {
    const r = await fetch(`${cfg.url}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "password", username: usuario, password: senha }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
    if (r.status === 400 || r.status === 401 || r.status === 403) return { ok: false, motivo: "credenciais" };
    if (!r.ok) return { ok: false, motivo: "indisponivel" };
    const userId = lerUserId(await r.json().catch(() => null));
    return userId ? { ok: true, userId } : { ok: false, motivo: "indisponivel" };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}

/** O login é da pessoa escolhida: o `userId` do Saúde é o id do Saúde do participante. */
export const mesmaPessoa = (userIdDoLogin: string, idErpDoParticipante: string | null) => !!idErpDoParticipante && userIdDoLogin.trim() === idErpDoParticipante.trim();

// ---------- Prova do login (e do modo do técnico) ----------

/**
 * Prova assinada de curta duração. `login_saude`: o login do participante passou (vale para aquela visita e aquele
 * participante). `sem_login`: o técnico abriu a presença sem login (vale para aquela visita).
 */
export type FinalidadeProva = "login_saude" | "sem_login";

const AUDIENCIA = "presenca";
const chave = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function assinarProva(d: { finalidade: FinalidadeProva; visitaId: string; participanteId?: string }, minutos: number): Promise<string> {
  return new SignJWT({ finalidade: d.finalidade, visitaId: d.visitaId, ...(d.participanteId ? { participanteId: d.participanteId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${minutos}m`)
    .sign(chave());
}

/** A prova é válida, não expirou e é para esta finalidade, esta visita e (se houver) este participante. */
export async function conferirProva(token: string | null | undefined, esperado: { finalidade: FinalidadeProva; visitaId: string; participanteId?: string }): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"], audience: AUDIENCIA });
    return payload.finalidade === esperado.finalidade && payload.visitaId === esperado.visitaId && (esperado.participanteId === undefined || payload.participanteId === esperado.participanteId);
  } catch {
    return false;
  }
}

// ---------- Limite de tentativas ----------

/*
 * Falhas de login por participante numa visita (e no total da visita), na memória do processo (o ReportS roda num processo
 * só; reiniciar zera). Passou do limite, a pessoa é mandada ao técnico. Só conta senha errada ou login de outra pessoa:
 * API fora do ar não conta.
 */
export const MAX_FALHAS_PESSOA = 5;
export const MAX_FALHAS_VISITA = 30;
const JANELA_FALHAS_MS = 10 * 60 * 1000;

const falhas = new Map<string, number[]>();
const recentes = (k: string, agora: number) => (falhas.get(k) ?? []).filter((t) => agora - t < JANELA_FALHAS_MS);

export function bloqueadoPorFalhas(visitaId: string, participanteId: string, agora = Date.now()): boolean {
  return recentes(`p:${visitaId}:${participanteId}`, agora).length >= MAX_FALHAS_PESSOA || recentes(`v:${visitaId}`, agora).length >= MAX_FALHAS_VISITA;
}

export function registrarFalha(visitaId: string, participanteId: string, agora = Date.now()) {
  for (const k of [`p:${visitaId}:${participanteId}`, `v:${visitaId}`]) falhas.set(k, [...recentes(k, agora), agora]);
  if (falhas.size > 2000) for (const [k, v] of falhas) if (!v.some((t) => agora - t < JANELA_FALHAS_MS)) falhas.delete(k);
}

export function limparFalhas(visitaId: string, participanteId: string) {
  falhas.delete(`p:${visitaId}:${participanteId}`);
}
