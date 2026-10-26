import "server-only";
import type { Foto } from "@/lib/types";

/*
 * Armazenamento de imagens — implementação MOCK em memória.
 * Na fase de banco, vira o Supabase Storage (bucket privado); `salvarImagem` continua devolvendo uma Foto.
 */

const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Limite por arquivo no servidor (o navegador já comprime para ~500 KB). */
export const TAMANHO_MAXIMO = 1.5 * 1024 * 1024;

interface Arquivo {
  tipo: string;
  dados: Buffer;
}

const g = globalThis as unknown as { __arquivos?: Map<string, Arquivo> };
const arquivos = (g.__arquivos ??= new Map());

/** Valida e guarda a imagem enviada. Devolve null se não for imagem aceita. */
export async function salvarImagem(arquivo: File): Promise<Foto | null> {
  if (!TIPOS.has(arquivo.type) || arquivo.size === 0 || arquivo.size > TAMANHO_MAXIMO) return null;
  const id = crypto.randomUUID();
  arquivos.set(id, { tipo: arquivo.type, dados: Buffer.from(await arquivo.arrayBuffer()) });
  return { id, url: `/arquivos/${id}` };
}

export async function lerArquivo(id: string): Promise<Arquivo | null> {
  return arquivos.get(id) ?? null;
}

/** Guarda um arquivo gerado pelo sistema (ex.: PDF do relatório). */
export async function salvarArquivo(dados: Buffer, tipo: string): Promise<Foto> {
  const id = crypto.randomUUID();
  arquivos.set(id, { tipo, dados });
  return { id, url: `/arquivos/${id}` };
}

/**
 * Bytes de uma imagem a partir do endereço usado nas visitas (/arquivos/…, /mock/… ou data:),
 * para embutir no PDF. Devolve null se não encontrar.
 */
export async function lerImagemPorUrl(url: string): Promise<Buffer | null> {
  if (url.startsWith("/arquivos/")) return (await lerArquivo(url.slice("/arquivos/".length)))?.dados ?? null;
  if (url.startsWith("/mock/")) {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return readFile(join(process.cwd(), "public", url)).catch(() => null);
  }
  const m = url.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  return m ? Buffer.from(m[2], "base64") : null;
}
