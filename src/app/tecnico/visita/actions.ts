"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";
import { equipesDaVisita, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { salvarImagem } from "@/lib/repo/arquivos";
import { buscarSetor } from "@/lib/repo/clientes";
import {
  adicionarFotoExtra,
  adicionarSetorExtra,
  buscarVisita,
  definirAnotacoes,
  definirEquipes,
  definirTemaAdicional,
  definirTemas,
  removerFotoExtra,
  removerSetorExtra,
} from "@/lib/repo/visitas";

/** Resultado simples das ações salvas na hora: null = ok; texto = erro para mostrar. */
type Resultado = string | null;

async function visitaAberta(visitaId: string) {
  const tecnico = await exigirPermissaoAcao(PERMISSOES.tecnico);
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
  // Aceita só temas do sistema do contrato da visita, ativos ou que já estavam marcados (caso tenham sido inativados durante a visita).
  const validos = new Set(
    (await listarTemas()).filter((t) => t.sistema === v.sistema && (t.ativo || v.temaIds.includes(t.id))).map((t) => t.id),
  );
  await definirTemas(visitaId, tecnico.id, temaIds.filter((id) => validos.has(id)));
  atualizar(visitaId);
  return null;
}

export async function salvarEquipes(visitaId: string, equipeIds: string[]): Promise<Resultado> {
  const { tecnico, v, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  if (!sugereTemasPorEquipe(v.tipo)) return "Este tipo de visita não registra equipes.";
  // As mesmas equipes que a tela mostra: com tema mínimo do sistema do contrato, ou já marcadas.
  const [equipes, temas] = await Promise.all([listarEquipes(), listarTemas()]);
  const validas = new Set(equipesDaVisita(equipes, temas, v.sistema, v.equipeIds).map((e) => e.id));
  await definirEquipes(visitaId, tecnico.id, equipeIds.filter((id) => validas.has(id)));
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

/**
 * Acrescenta um setor à visita (o técnico treinou mais gente do que previa). `valor` é o id de um setor do estabelecimento da
 * visita ou "outro", com o nome em `outro`. Vale até o check-out.
 */
export async function acrescentarSetor(visitaId: string, valor: string, outro: string): Promise<Resultado> {
  const { tecnico, v, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  let resultado: string | null;
  if (valor === "outro") {
    const nome = outro.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!nome) return "Digite o nome do setor.";
    resultado = await adicionarSetorExtra(visitaId, tecnico.id, { setorOutro: nome });
  } else {
    const setor = await buscarSetor(valor);
    if (!setor || setor.unidadeId !== v.unidadeId) return "Escolha o setor.";
    resultado = await adicionarSetorExtra(visitaId, tecnico.id, { setorId: setor.id });
  }
  atualizar(visitaId);
  return resultado;
}

export async function retirarSetorAcrescentado(visitaId: string, extraId: string): Promise<Resultado> {
  const { tecnico, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  await removerSetorExtra(visitaId, tecnico.id, extraId);
  atualizar(visitaId);
  return null;
}

const TAMANHO_ANOTACAO = 4000;

/** Anotações feitas durante a visita (as mesmas do check-out, que parte delas). Salvas enquanto o técnico escreve. */
export async function salvarAnotacoes(visitaId: string, a: { observacoes: string; pendencias: string; proximosPassos: string }): Promise<Resultado> {
  const { tecnico, erro } = await visitaAberta(visitaId);
  if (erro) return erro;
  const texto = (t: string) => String(t ?? "").trim().slice(0, TAMANHO_ANOTACAO);
  await definirAnotacoes(visitaId, tecnico.id, { observacoes: texto(a.observacoes), pendencias: texto(a.pendencias), proximosPassos: texto(a.proximosPassos) });
  atualizar(visitaId);
  return null;
}
