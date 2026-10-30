import "server-only";
import { plataforma } from "@/lib/db";
import { CATALOGO } from "@/lib/permissoes";

/*
 * Papéis e permissões — leitura da plataforma. Os papéis e a atribuição aos usuários são feitos no Admin do SINC
 * (RN-PL-65); o ReportS só lê e registra o catálogo das próprias permissões (scripts/registrar-permissoes.ts).
 */

const DO_REPORTS = CATALOGO.map((p) => p.codigo as string);

/**
 * Soma das permissões ativas dos papéis do usuário, lida a cada requisição (sem cache), para valer na próxima tela
 * (RN-PL-64). O papel protegido (Administrador) tem todas, inclusive as que ainda não foram registradas (RN-PL-63).
 */
export async function permissoesDoUsuario(userId: bigint): Promise<{ permissoes: string[]; papeis: string[] }> {
  const papeis = await plataforma.roles.findMany({
    where: { user_roles: { some: { user_id: userId } } },
    select: { nome: true, protegido: true, role_permissions: { select: { permissions: { select: { codigo: true, ativa: true } } } } },
    orderBy: { nome: "asc" },
  });
  let codigos: string[];
  if (papeis.some((p) => p.protegido)) {
    const ativas = await plataforma.permissions.findMany({ where: { ativa: true }, select: { codigo: true } });
    codigos = [...ativas.map((p) => p.codigo), ...DO_REPORTS];
  } else {
    codigos = papeis.flatMap((p) => p.role_permissions.filter((rp) => rp.permissions.ativa).map((rp) => rp.permissions.codigo));
  }
  return { permissoes: [...new Set(codigos)].sort(), papeis: papeis.map((p) => p.nome) };
}
