"use server";

import { revalidatePath } from "next/cache";
import { exigirTecnicoAcao } from "@/lib/dal";
import { listarTemas } from "@/lib/repo/temas";
import { salvarImagem } from "@/lib/repo/arquivos";
import { adicionarFotoExtra, buscarVisita, definirTemaAdicional, definirTemas, removerFotoExtra } from "@/lib/repo/visitas";

/** Resultado simples das ações salvas na hora: null = ok; texto = erro para mostrar. */
type Resultado = string | null;

async function visitaAberta(visitaId: string) {
  const tecnico = await exigirTecnicoAcao();
  const v = await buscarVisita(visitaId);
  if (!v || v.tecnicoId !== tecnico.id) throw new Error("Visita não encontrada");
  if (v.status !== "em_andamento") return { tecnico, v, erro: "Esta visita já foi encerrada." };
  return { tecnico, v, erro: null };
}

const atualizar = (id: string) => {
  revalidatePath(`/tecnico/visita/${id}`);
  revalidatePath("/admin/visitas", "layout");
};

export async function salvarTemas(visitaId: string, temaIds: string[]): Promise<Resultado> {
  const { tecnico, v, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  // Aceita temas ativos ou que já estavam marcados (caso tenham sido inativados durante a visita).
  const validos = new Set((await listarTemas()).filter((t) => t.ativo || v.temaIds.includes(t.id)).map((t) => t.id));
  await definirTemas(visitaId, tecnico.id, temaIds.filter((id) => validos.has(id)));
  atualizar(visitaId);
  return null;
}

export async function salvarTemaAdicional(visitaId: string, texto: string): Promise<Resultado> {
  const { tecnico, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  await definirTemaAdicional(visitaId, tecnico.id, texto.trim().slice(0, 300));
  atualizar(visitaId);
  return null;
}

/** Recebe UMA foto já comprimida no campo "foto". */
export async function enviarFotoExtra(visitaId: string, fd: FormData): Promise<Resultado> {
  const { tecnico, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  const arquivo = fd.get("foto");
  const foto = arquivo instanceof File ? await salvarImagem(arquivo) : null;
  if (!foto) return "Imagem inválida ou muito grande.";
  await adicionarFotoExtra(visitaId, tecnico.id, foto);
  atualizar(visitaId);
  return null;
}

export async function apagarFotoExtra(visitaId: string, fotoId: string): Promise<Resultado> {
  const { tecnico, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  await removerFotoExtra(visitaId, tecnico.id, fotoId);
  atualizar(visitaId);
  return null;
}
