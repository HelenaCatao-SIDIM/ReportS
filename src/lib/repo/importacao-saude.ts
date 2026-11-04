import "server-only";
import { idPlataforma, idTexto, plataforma, reports } from "@/lib/db";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import {
  contarEstabelecimentos,
  contarParticipantes,
  estabelecimentosDosFuncionarios,
  planejarEstabelecimentos,
  planejarParticipantes,
  type ResumoImportacao,
} from "@/lib/importacao-saude";
import { ErroSaude, acessoDoTenant, buscarFuncionarios } from "@/lib/saude-api";
import { buscarSistemaDoCliente } from "./clientes";

/*
 * Importação do SIDIM Saúde para um sistema do cliente: estabelecimentos (banco do ReportS, do cliente) e profissionais
 * (participantes confirmados da plataforma, daquele sistema do cliente). As regras estão em src/lib/importacao-saude.ts.
 *
 * Ordem entre os bancos: primeiro os estabelecimentos, depois os participantes. Se a plataforma recusar os
 * participantes, os estabelecimentos já gravados ficam (repetir a importação não os duplica) e o resumo avisa.
 * A inclusão do participante é em SQL direto, como no provisório, para não mandar as colunas com valor padrão.
 */

/** O banco recusou a gravação por permissão (42501) ou pela regra de valores aceitos (23514): falta a liberação no SINC. */
function recusadoPeloBanco(e: unknown) {
  const texto = `${(e as { message?: string })?.message ?? ""} ${JSON.stringify((e as { meta?: unknown })?.meta ?? "")}`;
  return /42501|23514|permission denied|violates check constraint/i.test(texto);
}

export async function importarDoSaude(sistemaDoClienteId: string, importadoPor: string): Promise<ResumoImportacao> {
  const sistema = await buscarSistemaDoCliente(sistemaDoClienteId);
  if (!sistema) throw new ErroSaude("Sistema do cliente não encontrado.");
  const acesso = acessoDoTenant(sistema.tenantId);
  if (!acesso) throw new ErroSaude("A importação não está configurada para este tenant.");

  const funcionarios = await buscarFuncionarios(acesso);

  // ---------- Estabelecimentos ----------
  const clienteId = idPlataforma(sistema.clienteId)!;
  const existentes = await reports.estabelecimento.findMany({ where: { clienteId }, select: { id: true, nome: true, endereco: true, idErp: true } });
  const planoEstab = planejarEstabelecimentos(existentes, estabelecimentosDosFuncionarios(funcionarios));
  await reports.$transaction(
    planoEstab.flatMap((p) => {
      if (p.acao === "criar") {
        return [reports.estabelecimento.create({ data: { id: crypto.randomUUID(), clienteId, nome: p.nome, endereco: p.endereco, idErp: p.idErp, raioMetros: RAIO_PADRAO_METROS } })];
      }
      if (p.acao === "ligar") return [reports.estabelecimento.update({ where: { id: p.id }, data: { idErp: p.idErp, ...(p.endereco ? { endereco: p.endereco } : {}) } })];
      if (p.acao === "atualizar") return [reports.estabelecimento.update({ where: { id: p.id }, data: { endereco: p.endereco } })];
      return [];
    }),
  );

  // ---------- Profissionais ----------
  const chave = idPlataforma(sistemaDoClienteId)!;
  const [pessoas, cbos] = await Promise.all([
    plataforma.client_users.findMany({ where: { client_id: chave }, select: { id: true, external_user_id: true, estado: true, nome: true, cpf: true, cbo_codigo: true } }),
    reports.cbo.findMany({ where: { codigo: { in: [...new Set(funcionarios.flatMap((f) => f.cbos))] } } }),
  ]);
  const planoPart = planejarParticipantes(
    pessoas.map((p) => ({ id: idTexto(p.id), idErp: p.external_user_id, estado: p.estado, nome: p.nome ?? "", cpf: p.cpf, cboCodigo: p.cbo_codigo })),
    funcionarios,
    new Map(cbos.map((c) => [c.codigo, c])),
  );

  let avisoParticipantes: string | null = null;
  try {
    for (const p of planoPart) {
      if (p.acao === "criar") {
        await plataforma.$executeRaw`
          INSERT INTO client_users (client_id, external_user_id, nome, estado, origem, cpf, cbo_codigo, cbo_titulo, criado_por_user_id)
          VALUES (${chave}, ${p.idUsuario}, ${p.nome}, 'confirmado', 'importacao_saude', ${p.cpf}, ${p.cbo?.codigo ?? null}, ${p.cbo?.titulo ?? null},
                  ${idPlataforma(importadoPor)})`;
      } else if (p.acao === "atualizar") {
        await plataforma.client_users.update({
          where: { id: idPlataforma(p.id)! },
          data: { ...(p.cpf ? { cpf: p.cpf } : {}), ...(p.cbo ? { cbo_codigo: p.cbo.codigo, cbo_titulo: p.cbo.titulo } : {}), updated_at: new Date() },
        });
      }
    }
  } catch (e) {
    if (!recusadoPeloBanco(e)) throw e;
    avisoParticipantes =
      "Os profissionais não foram gravados: o banco da plataforma ainda não libera ao ReportS a inclusão de participantes confirmados vindos do Saúde. Peça a liberação ao time do SINC e importe de novo.";
  }

  const contagem = contarParticipantes(planoPart);
  return {
    funcionarios: funcionarios.length,
    estabelecimentos: contarEstabelecimentos(planoEstab),
    ...contagem,
    ...(avisoParticipantes ? { participantes: { ...contagem.participantes, criados: 0, atualizados: 0 } } : {}),
    avisoParticipantes,
  };
}
