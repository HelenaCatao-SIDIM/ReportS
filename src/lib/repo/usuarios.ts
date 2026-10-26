import "server-only";
import bcrypt from "bcryptjs";
import type { Perfil, Usuario, UsuarioPublico } from "@/lib/types";

/*
 * Repositório de usuários — implementação MOCK em memória.
 * Na fase de banco, só este arquivo muda (Prisma/Postgres); as telas continuam iguais.
 * Senha de teste de todos os usuários seed: "sidim123" (apenas ambiente de desenvolvimento).
 */

const SENHA_SEED = "sidim123";

function seed(): Usuario[] {
  const hash = bcrypt.hashSync(SENHA_SEED, 10);
  return [
    { id: "u1", nome: "Gestor SIDIM", email: "gestor@sidim.com.br", senhaHash: hash, perfil: "gestor", ativo: true },
    { id: "u2", nome: "Ana Souza", email: "ana@sidim.com.br", senhaHash: hash, perfil: "tecnico", ativo: true },
    { id: "u3", nome: "Carlos Lima", email: "carlos@sidim.com.br", senhaHash: hash, perfil: "tecnico", ativo: true },
    { id: "u4", nome: "Paulo Inativo", email: "paulo@sidim.com.br", senhaHash: hash, perfil: "tecnico", ativo: false },
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const store = globalThis as unknown as { __usuarios?: Usuario[] };
const usuarios = (store.__usuarios ??= seed());

function publico(u: Usuario): UsuarioPublico {
  const { senhaHash, ...resto } = u;
  void senhaHash;
  return resto;
}

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export async function buscarPorId(id: string): Promise<UsuarioPublico | null> {
  const u = usuarios.find((x) => x.id === id);
  return u ? publico(u) : null;
}

/** Retorna o usuário se e-mail e senha conferem e ele está ativo. */
export async function autenticar(email: string, senha: string): Promise<UsuarioPublico | null> {
  const u = usuarios.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || !u.ativo) return null;
  return (await bcrypt.compare(senha, u.senhaHash)) ? publico(u) : null;
}

/** Lista ordenada por nome, com busca por nome (sem acento) e filtro de perfil. */
export async function listarUsuarios(filtro: { busca?: string; perfil?: Perfil } = {}): Promise<UsuarioPublico[]> {
  const busca = normalizar(filtro.busca ?? "");
  return usuarios
    .filter((u) => !filtro.perfil || u.perfil === filtro.perfil)
    .filter((u) => !busca || normalizar(u.nome).includes(busca))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map(publico);
}

export async function emailEmUso(email: string, excetoId?: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  return usuarios.some((u) => u.email.toLowerCase() === e && u.id !== excetoId);
}

export interface DadosUsuario {
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}

export async function criarUsuario(dados: DadosUsuario & { senha: string }): Promise<UsuarioPublico> {
  const { senha, ...resto } = dados;
  const u: Usuario = { ...resto, id: crypto.randomUUID(), email: resto.email.trim().toLowerCase(), senhaHash: await bcrypt.hash(senha, 10) };
  usuarios.push(u);
  return publico(u);
}

/** Atualiza dados; a senha só muda quando `novaSenha` é informada. */
export async function atualizarUsuario(id: string, dados: DadosUsuario & { novaSenha?: string }): Promise<void> {
  const u = usuarios.find((x) => x.id === id);
  if (!u) throw new Error("Usuário não encontrado");
  const { novaSenha, ...resto } = dados;
  Object.assign(u, resto, { email: resto.email.trim().toLowerCase() });
  if (novaSenha) u.senhaHash = await bcrypt.hash(novaSenha, 10);
}

export async function definirAtivo(id: string, ativo: boolean): Promise<void> {
  const u = usuarios.find((x) => x.id === id);
  if (u) u.ativo = ativo;
}
