import "server-only";
import { headers } from "next/headers";

/*
 * Limite de tentativas de login: até 10 em 3 minutos por IP, como o SINC (RN-PL-55). Conta toda tentativa, certa ou
 * errada. Fica na memória do processo: o ReportS roda num processo só (reports-web); reiniciar zera a contagem.
 * O IP vem do cabeçalho X-Real-IP que o nginx grava (o X-Forwarded-For pode vir preenchido pelo próprio navegador).
 */

const MAXIMO = 10;
const JANELA_MS = 3 * 60 * 1000;

const tentativas = new Map<string, number[]>();

async function ip() {
  return (await headers()).get("x-real-ip")?.trim() || "desconhecido";
}

/** Registra uma tentativa e diz se ela passou do limite. */
export async function excedeuLimite(): Promise<boolean> {
  const chave = await ip();
  const agora = Date.now();
  const recentes = (tentativas.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  tentativas.set(chave, recentes);
  // Limpa de vez em quando os IPs que não tentam há mais de uma janela.
  if (tentativas.size > 1000) {
    for (const [k, v] of tentativas) if (!v.some((t) => agora - t < JANELA_MS)) tentativas.delete(k);
  }
  return recentes.length > MAXIMO;
}
