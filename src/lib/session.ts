import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/** A sessão guarda só o id do usuário (RN-PL-71): as permissões são lidas a cada requisição, no cadastro. */
export interface SessionPayload {
  userId: string;
  [key: string]: unknown;
}

const COOKIE = "sessao";
const DURACAO_MS = 12 * 60 * 60 * 1000; // 12 horas
const chave = new TextEncoder().encode(process.env.SESSION_SECRET);

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(chave);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, chave, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + DURACAO_MS);
  const token = await encrypt({ userId });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function readSession() {
  return decrypt((await cookies()).get(COOKIE)?.value);
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
