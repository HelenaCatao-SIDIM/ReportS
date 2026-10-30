import "server-only";
import bcrypt from "bcryptjs";
import { idPlataforma, idTexto, plataforma } from "@/lib/db";
import type { UsuarioLogado, UsuarioPublico } from "@/lib/types";
import { permissoesDoUsuario } from "./permissoes";

/*
 * Repositório de usuários — leitura da tabela `users` da plataforma (o cadastro único da SIDIM).
 * Convite, senha, nome, telefone, papéis e revogação são feitos no Admin do SINC; o ReportS só lê, para o login e
 * para mostrar nomes. A senha é o resumo bcrypt que o Rails grava ($2a$), conferido com o bcryptjs.
 */

type Linha = { id: bigint; nome: string | null; email_address: string; telefone: string | null; active: boolean; user_roles: { role_id: bigint }[] };

const SELECAO = { id: true, nome: true, email_address: true, telefone: true, active: true, user_roles: { select: { role_id: true } } } as const;

function publico(u: Linha): UsuarioPublico {
  return {
    id: idTexto(u.id),
    // Usuários migrados do SINC podem estar sem nome até alguém preencher (RN-PL-51): mostra o e-mail.
    nome: u.nome ?? u.email_address,
    email: u.email_address,
    ativo: u.active,
    telefone: u.telefone,
    papelIds: u.user_roles.map((r) => idTexto(r.role_id)),
  };
}

export async function buscarPorId(id: string): Promise<UsuarioPublico | null> {
  const chave = idPlataforma(id);
  if (chave === null) return null;
  const u = await plataforma.users.findUnique({ where: { id: chave }, select: SELECAO });
  return u ? publico(u) : null;
}

/** Nomes dos usuários pelos ids (para listas), sem repetir consultas. */
export async function nomesDosUsuarios(ids: string[]): Promise<Map<string, string>> {
  const chaves = [...new Set(ids)].map(idPlataforma).filter((x): x is bigint => x !== null);
  if (!chaves.length) return new Map();
  const linhas = await plataforma.users.findMany({ where: { id: { in: chaves } }, select: { id: true, nome: true, email_address: true } });
  return new Map(linhas.map((u) => [idTexto(u.id), u.nome ?? u.email_address]));
}

/** Usuário ativo com as permissões atuais dele (lidas agora, sem cache). */
export async function buscarLogadoPorId(id: string): Promise<UsuarioLogado | null> {
  const chave = idPlataforma(id);
  if (chave === null) return null;
  const u = await plataforma.users.findUnique({ where: { id: chave }, select: SELECAO });
  if (!u?.active) return null;
  return { ...publico(u), ...(await permissoesDoUsuario(u.id)) };
}

/** Retorna o usuário se e-mail e senha conferem e ele está ativo. */
export async function autenticar(email: string, senha: string): Promise<UsuarioLogado | null> {
  const u = await plataforma.users.findUnique({
    where: { email_address: email.trim().toLowerCase() },
    select: { ...SELECAO, password_digest: true },
  });
  if (!u?.active) return null;
  if (!(await bcrypt.compare(senha, u.password_digest))) return null;
  return { ...publico(u), ...(await permissoesDoUsuario(u.id)) };
}

/** Usuários ativos que têm a permissão (ex.: quem pode ser escolhido como técnico no filtro de visitas). */
export async function listarComPermissao(codigo: string): Promise<UsuarioPublico[]> {
  const ativos = await plataforma.users.findMany({
    where: {
      active: true,
      user_roles: {
        some: {
          roles: {
            OR: [{ protegido: true }, { role_permissions: { some: { permissions: { codigo, ativa: true } } } }],
          },
        },
      },
    },
    select: SELECAO,
  });
  return ativos.map(publico).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
