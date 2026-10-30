import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reports } from "@/lib/db";
import type { Foto } from "@/lib/types";

/*
 * Fotos, prints, assinaturas e PDFs: guardados no disco do servidor, na pasta ARQUIVOS_DIR (fora da pasta pública,
 * entra no backup), em subpastas por ano e mês. O banco guarda o tipo, o tamanho e o caminho relativo.
 * Só são servidos por /arquivos/[id] (com login) e pelo link de aprovação (só os arquivos da versão).
 */

const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Limite por arquivo no servidor (o navegador já comprime para ~500 KB). */
export const TAMANHO_MAXIMO = 1.5 * 1024 * 1024;

const ID = /^[0-9a-f-]{36}$/;

/** Pasta raiz dos arquivos. Em desenvolvimento, ./tmp/arquivos. */
function pasta() {
  const dir = process.env.ARQUIVOS_DIR?.trim();
  if (!dir && process.env.NODE_ENV === "production") throw new Error("ARQUIVOS_DIR não definido");
  return resolve(dir || "./tmp/arquivos");
}

interface Arquivo {
  tipo: string;
  dados: Buffer;
}

/** Grava no disco (primeiro num nome temporário, para nunca deixar arquivo pela metade) e registra no banco. */
async function guardar(dados: Buffer, tipo: string): Promise<Foto> {
  const id = crypto.randomUUID();
  const agora = new Date();
  const relativo = join(String(agora.getUTCFullYear()), String(agora.getUTCMonth() + 1).padStart(2, "0"), id);
  const destino = join(pasta(), relativo);
  await mkdir(join(destino, ".."), { recursive: true });
  await writeFile(`${destino}.parcial`, dados, { mode: 0o640 });
  await rename(`${destino}.parcial`, destino);
  await reports.arquivo.create({ data: { id, tipo, tamanho: dados.length, caminho: relativo } });
  return { id, url: `/arquivos/${id}` };
}

/** Valida e guarda a imagem enviada. Devolve null se não for imagem aceita. */
export async function salvarImagem(arquivo: File): Promise<Foto | null> {
  if (!TIPOS.has(arquivo.type) || arquivo.size === 0 || arquivo.size > TAMANHO_MAXIMO) return null;
  return guardar(Buffer.from(await arquivo.arrayBuffer()), arquivo.type);
}

export async function lerArquivo(id: string): Promise<Arquivo | null> {
  if (!ID.test(id)) return null;
  const registro = await reports.arquivo.findUnique({ where: { id } });
  if (!registro) return null;
  const dados = await readFile(join(pasta(), registro.caminho)).catch(() => null);
  if (!dados) {
    console.error(`[arquivos] ${id} está no banco mas não no disco (${registro.caminho})`);
    return null;
  }
  return { tipo: registro.tipo, dados };
}

/** Guarda um arquivo gerado pelo sistema (ex.: PDF do relatório). */
export async function salvarArquivo(dados: Buffer, tipo: string): Promise<Foto> {
  return guardar(dados, tipo);
}

/**
 * Bytes de uma imagem a partir do endereço usado nas visitas (/arquivos/…, /mock/… dos dados de exemplo ou data:),
 * para embutir no PDF. Devolve null se não encontrar.
 */
export async function lerImagemPorUrl(url: string): Promise<Buffer | null> {
  if (url.startsWith("/arquivos/")) return (await lerArquivo(url.slice("/arquivos/".length)))?.dados ?? null;
  if (/^\/mock\/[\w.-]+$/.test(url)) return readFile(join(process.cwd(), "public", url)).catch(() => null);
  const m = url.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  return m ? Buffer.from(m[2], "base64") : null;
}
