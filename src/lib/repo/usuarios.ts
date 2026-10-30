import "server-only";
import bcrypt from "bcryptjs";
import type { Usuario, UsuarioLogado, UsuarioPublico } from "@/lib/types";
import { permissoesDosPapeis } from "./permissoes";

/*
 * Repositório de usuários — implementação MOCK em memória, só leitura.
 * O cadastro de usuários e a atribuição de papéis são feitos no Admin do SINC; o ReportS só lê,
 * para o login e para mostrar nomes. Na fase de banco, só este arquivo muda (leitura da plataforma).
 * Senha de teste de todos os usuários seed: "sidim123" (apenas ambiente de desenvolvimento).
 */

const SENHA_SEED = "sidim123";

function seed(): Usuario[] {
  const hash = bcrypt.hashSync(SENHA_SEED, 10);
  const u = (id: string, nome: string, email: string, papelIds: string[], ativo = true): Usuario => ({ id, nome, email, senhaHash: hash, ativo, telefone: null, papelIds });
  return [
    u("u1", "Coordenação SIDIM", "gestor@sidim.com.br", ["coordenacao"]),
    u("u2", "Ana Souza", "ana@sidim.com.br", ["tecnico-de-campo"]),
    u("u3", "Carlos Lima", "carlos@sidim.com.br", ["tecnico-de-campo"]),
    u("u4", "Paulo Inativo", "paulo@sidim.com.br", ["tecnico-de-campo"], false),
    u("u5", "Fernanda Faturamento", "faturamento@sidim.com.br", ["faturamento"]),
    u("u6", "Sem Acesso", "semacesso@sidim.com.br", []),
  ];
}

// Mantém os dados entre recargas do servidor de desenvolvimento.
const store = globalThis as unknown as { __usuariosV2?: Usuario[] };
const usuarios = (store.__usuariosV2 ??= seed());

function publico(u: Usuario): UsuarioPublico {
  const { senhaHash, ...resto } = u;
  void senhaHash;
  return resto;
}

export async function buscarPorId(id: string): Promise<UsuarioPublico | null> {
  const u = usuarios.find((x) => x.id === id);
  return u ? publico(u) : null;
}

/** Usuário ativo com as permissões atuais dele (lidas agora, sem cache). */
export async function buscarLogadoPorId(id: string): Promise<UsuarioLogado | null> {
  const u = usuarios.find((x) => x.id === id);
  if (!u?.ativo) return null;
  return { ...publico(u), ...(await permissoesDosPapeis(u.papelIds)) };
}

/** Retorna o usuário se e-mail e senha conferem e ele está ativo. */
export async function autenticar(email: string, senha: string): Promise<UsuarioLogado | null> {
  const u = usuarios.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || !u.ativo) return null;
  if (!(await bcrypt.compare(senha, u.senhaHash))) return null;
  return { ...publico(u), ...(await permissoesDosPapeis(u.papelIds)) };
}

/** Usuários ativos que têm a permissão (ex.: quem pode ser escolhido como técnico no filtro de visitas). */
export async function listarComPermissao(codigo: string): Promise<UsuarioPublico[]> {
  const achados: UsuarioPublico[] = [];
  for (const u of usuarios) {
    if (!u.ativo) continue;
    if ((await permissoesDosPapeis(u.papelIds)).permissoes.includes(codigo)) achados.push(publico(u));
  }
  return achados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
