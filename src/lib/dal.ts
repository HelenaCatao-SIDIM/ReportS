import "server-only";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { buscarPorId } from "@/lib/repo/usuarios";
import type { Perfil } from "@/lib/types";

/** Página inicial de cada perfil após o login. */
export const HOME: Record<Perfil, string> = { gestor: "/admin", tecnico: "/tecnico" };

/** Usuário autenticado e ativo, ou null. Cache privado (só no navegador) para navegação instantânea. */
export async function getUsuarioAtual() {
  "use cache: private";
  const sessao = await readSession();
  if (!sessao) return null;
  const usuario = await buscarPorId(sessao.userId);
  return usuario?.ativo ? usuario : null;
}

/** Exige login com o perfil informado; senão redireciona. */
export async function exigirPerfil(perfil: Perfil) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/sair");
  // O proxy já separa as áreas pelo perfil do cookie. Se o cadastro tem outro perfil, o cookie ficou velho (alguém mudou
  // o papel da pessoa enquanto ela estava logada). Mandar para a área do cadastro faria o proxy devolvê-la, num laço sem fim:
  // sai e pede um novo login.
  if (usuario.perfil !== perfil) redirect("/sair");
  return usuario;
}

/** Para Server Actions: confere a sessão direto no cookie (sem cache) e exige o perfil gestor. */
export async function exigirGestorAcao() {
  const sessao = await readSession();
  const usuario = sessao ? await buscarPorId(sessao.userId) : null;
  if (!usuario?.ativo || usuario.perfil !== "gestor") throw new Error("Acesso negado");
  return usuario;
}

/** Para Server Actions usadas pelos dois perfis: exige apenas um usuário logado e ativo. */
export async function exigirLogadoAcao() {
  const sessao = await readSession();
  const usuario = sessao ? await buscarPorId(sessao.userId) : null;
  if (!usuario?.ativo) throw new Error("Acesso negado");
  return usuario;
}

/** Para Server Actions do App do Técnico: exige o perfil técnico. */
export async function exigirTecnicoAcao() {
  const sessao = await readSession();
  const usuario = sessao ? await buscarPorId(sessao.userId) : null;
  if (!usuario?.ativo || usuario.perfil !== "tecnico") throw new Error("Acesso negado");
  return usuario;
}
