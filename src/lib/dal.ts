import "server-only";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { buscarLogadoPorId } from "@/lib/repo/usuarios";
import { acessoAdministracao, acessoTecnico, temAlguma } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/types";

/**
 * Usuário autenticado e ativo, com as permissões de agora, ou null.
 * Sem cache: revogar o acesso ou mudar uma permissão vale na próxima tela ou ação (RN-PL-52 e 64).
 */
export async function getUsuarioAtual(): Promise<UsuarioLogado | null> {
  const sessao = await readSession();
  return sessao ? buscarLogadoPorId(sessao.userId) : null;
}

/**
 * Para páginas e layouts: exige login e ao menos uma das permissões; senão redireciona.
 * Sem login (ou usuário inativo) limpa a sessão. Com login mas sem a permissão, volta a /inicio,
 * que leva à área que a pessoa pode usar (ou avisa que ela não tem acesso).
 */
export async function exigirPermissao(...permissoes: string[]): Promise<UsuarioLogado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/sair");
  if (!temAlguma(usuario.permissoes, permissoes)) redirect("/inicio");
  return usuario;
}

/** Para páginas da Administração: exige acesso à Administração e, se informadas, ao menos uma das permissões da tela. */
export async function exigirAdministracao(...permissoes: string[]): Promise<UsuarioLogado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/sair");
  if (!acessoAdministracao(usuario.permissoes)) redirect("/inicio");
  // Sem a permissão desta tela, mas na Administração: volta ao início dela com o aviso.
  if (permissoes.length && !temAlguma(usuario.permissoes, permissoes)) redirect("/admin?negado=1");
  return usuario;
}

/** Para o App do Técnico. */
export async function exigirTecnico(): Promise<UsuarioLogado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/sair");
  if (!acessoTecnico(usuario.permissoes)) redirect("/inicio");
  return usuario;
}

/** Para Server Actions: confere a sessão direto no cookie (sem cache) e exige ao menos uma das permissões. */
export async function exigirPermissaoAcao(...permissoes: string[]): Promise<UsuarioLogado> {
  const usuario = await getUsuarioAtual();
  if (!usuario || !temAlguma(usuario.permissoes, permissoes)) throw new Error("Acesso negado");
  return usuario;
}
