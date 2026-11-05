import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/*
 * Cifra segredos guardados no banco (ex.: a chave do n8n), com AES-256-GCM e uma chave derivada do SESSION_SECRET do servidor.
 * Quem lê só o banco não vê o segredo. Se o SESSION_SECRET mudar, os segredos guardados deixam de abrir (`decifrar` devolve
 * null) e é preciso informá-los de novo na Administração.
 */

const chave = (): Buffer => {
  const base = process.env.SESSION_SECRET;
  if (!base) throw new Error("SESSION_SECRET não definido");
  return Buffer.from(hkdfSync("sha256", base, "reports-configuracoes", "segredos-no-banco", 32));
};

/** "v1.<iv>.<etiqueta>.<dados>", tudo em base64. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(".");
}

/** O texto original, ou null se o valor foi alterado, não é nosso ou o SESSION_SECRET é outro. */
export function decifrar(valor: string): string | null {
  try {
    const [versao, iv, etiqueta, dados] = valor.split(".");
    if (versao !== "v1" || !iv || !etiqueta || !dados) return null;
    const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(etiqueta, "base64"));
    return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
