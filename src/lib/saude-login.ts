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
 * Desligado por padrão, por tenant, com variáveis do servidor (tenant em maiúsculas e sem símbolos):
 *   SAUDE_API_<TENANT>_URL                 endereço da API do tenant (ex.: https://.../api_parademinas)
 *   SAUDE_API_<TENANT>_LOGIN_PARTICIPANTE  "true" para ligar
 * A senha viaja até a API: **em produção só liga com https://** (em desenvolvimento, http:// é aceito para testar).
 */

/** "saude_parademinas" → "SAUDE_API_SAUDE_PARADEMINAS". */
export const prefixoDoTenant = (tenant: string) => `SAUDE_API_${normalizar(tenant).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

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

/** Configuração do login do participante no tenant, ou null se estiver desligado (ou sem endereço, ou http:// em produção). */
export function configLoginDoTenant(
  tenant: string | null,
  env: Record<string, string | undefined> = process.env,
  producao: boolean = process.env.NODE_ENV === "production",
): ConfigLogin | null {
  if (!tenant?.trim()) return null;
  const p = prefixoDoTenant(tenant);
  if (env[`${p}_LOGIN_PARTICIPANTE`]?.trim().toLowerCase() !== "true") return null;
  const url = enderecoBase(env[`${p}_URL`]);
  if (!url) return null;
  if (!urlPermitida(url, producao)) {
    if (!avisados.has(p)) {
      avisados.add(p);
      console.warn(`[saude-login] ${p}_LOGIN_PARTICIPANTE está ligado, mas ${p}_URL não é https://: em produção o login do participante fica desligado.`);
    }
    return null;
  }
  return { url };
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
