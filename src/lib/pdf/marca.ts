import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSINATURA, LOGO } from "@/lib/sidim";

/** Logo e assinatura da SIDIM já carregadas (o react-pdf não busca endereços do site). */
export interface MarcaPdf {
  logo: { data: Buffer; format: "png" };
  assinatura: { data: Buffer; format: "png" };
}

const doSite = (arquivo: string) => readFile(path.join(process.cwd(), "public", arquivo));

/** Lê as imagens de `public/sidim/`. Se faltarem, o PDF sai sem elas (e o erro vai para o log), em vez de deixar de emitir. */
export async function carregarMarcaPdf(): Promise<MarcaPdf | undefined> {
  try {
    const [logo, assinatura] = await Promise.all([doSite(LOGO.arquivo), doSite(ASSINATURA.arquivo)]);
    return { logo: { data: logo, format: "png" }, assinatura: { data: assinatura, format: "png" } };
  } catch (e) {
    console.error("[pdf] logo ou assinatura da SIDIM não encontradas em public/sidim:", e instanceof Error ? e.message : e);
    return undefined;
  }
}
