import "server-only";
import { idPlataforma, idTexto, reports } from "@/lib/db";
import { RAIO_PADRAO_METROS } from "@/lib/distancia";
import { prazoValido } from "@/lib/cronograma";
import {
  LIMITE_LINHAS,
  LIMITE_NOME,
  LIMITE_OBSERVACAO,
  chaveEstab,
  chaveItem,
  chaveNome,
  type ContextoImportacao,
  type PedidoLinha,
  type UnidadeCtx,
} from "@/lib/importar-cronograma";
import { TIPOS_VISITA } from "@/lib/visitas";
import type { TipoVisita } from "@/lib/types";
import { listarContratos } from "./contratos";

/*
 * Importação do cronograma — o que existe hoje no sistema (para a prévia) e a gravação, que confere tudo de novo:
 * o pedido vem do navegador, então nada nele é aceito sem checar contra o banco. É tudo ou nada: se uma linha tem
 * problema, nada é gravado.
 */

export async function carregarContextoImportacao(): Promise<ContextoImportacao> {
  const contratos = (await listarContratos()).map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    clienteNome: c.clienteNome,
    sistemaCodigo: c.sistema,
    sistemaNome: c.sistemaNome,
    tenantId: c.tenantId,
    ativo: c.ativo && c.clienteAtivo,
  }));
  const ativos = contratos.filter((c) => c.ativo);
  const clienteIds = [...new Set(ativos.map((c) => c.clienteId))].map((id) => idPlataforma(id)).filter((x): x is bigint => x !== null);

  const unidades: Record<string, UnidadeCtx[]> = {};
  if (clienteIds.length) {
    const linhas = await reports.estabelecimento.findMany({
      where: { clienteId: { in: clienteIds } },
      select: { id: true, nome: true, clienteId: true },
      orderBy: { nome: "asc" },
    });
    for (const u of linhas) (unidades[idTexto(u.clienteId)] ??= []).push({ id: u.id, nome: u.nome });
  }

  const equipes = await reports.equipe.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });

  const existentes = ativos.length
    ? (
        await reports.itemCronograma.findMany({
          where: { cancelado: false, contratoId: { in: ativos.map((c) => c.id) } },
          select: { contratoId: true, estabelecimentoId: true, tipo: true, equipes: { select: { equipeId: true } } },
        })
      ).map((i) => ({ contratoId: i.contratoId, unidadeId: i.estabelecimentoId, equipeIds: i.equipes.map((e) => e.equipeId), tipo: i.tipo as TipoVisita }))
    : [];
  return { contratos, unidades, equipes, existentes };
}

export type ResultadoImportacao =
  | { ok: true; criados: number; ignorados: number; estabelecimentosCriados: number }
  | { ok: false; erros: { linha: number; mensagem: string }[] };

/**
 * Grava o que o usuário aprovou. `podeCadastrar` diz se ele pode criar estabelecimentos (`reports.clientes.cadastrar`);
 * sem isso, só vale usar os que já existem. As equipes precisam ser equipes ativas do cadastro.
 */
export async function gravarImportacao(pedido: PedidoLinha[], podeCadastrar: boolean): Promise<ResultadoImportacao> {
  if (!Array.isArray(pedido) || pedido.length === 0) return { ok: false, erros: [{ linha: 0, mensagem: "Não há nenhum item para importar." }] };
  if (pedido.length > LIMITE_LINHAS) return { ok: false, erros: [{ linha: 0, mensagem: `Mais de ${LIMITE_LINHAS} linhas.` }] };

  const ctx = await carregarContextoImportacao();
  const contratos = new Map(ctx.contratos.filter((c) => c.ativo).map((c) => [c.id, c]));
  const existentes = new Set(ctx.existentes.map((e) => chaveItem(e.contratoId, e.unidadeId, e.equipeIds, e.tipo)));
  const equipesAtivas = new Set(ctx.equipes.map((e) => e.id));
  const vistos = new Set<string>();

  const erros: { linha: number; mensagem: string }[] = [];
  const novasUnidades = new Map<string, { id: string; clienteId: bigint; nome: string }>();
  const itens: { id: string; clienteId: bigint; contratoId: string; estabelecimentoId: string; tipo: string; prazo: Date; observacao: string }[] = [];
  const equipesDosItens: { itemId: string; equipeId: string }[] = [];
  let ignorados = 0;
  const semPermissao = "Você não tem permissão para cadastrar estabelecimentos (reports.clientes.cadastrar). Use um que já existe.";

  for (const p of pedido) {
    const erro = (mensagem: string) => erros.push({ linha: Number(p?.linha) || 0, mensagem });
    const contrato = contratos.get(String(p?.contratoId));
    if (!contrato) {
      erro("O contrato não existe ou está inativo.");
      continue;
    }
    if (!TIPOS_VISITA.some((t) => t.valor === p.atividade)) {
      erro("Atividade inválida.");
      continue;
    }
    if (typeof p.prazo !== "string" || !prazoValido(p.prazo)) {
      erro("Prazo inválido.");
      continue;
    }
    const observacao = typeof p.observacao === "string" ? p.observacao.trim() : "";
    if (observacao.length > LIMITE_OBSERVACAO) {
      erro(`Observação com mais de ${LIMITE_OBSERVACAO} caracteres.`);
      continue;
    }
    const clienteBig = idPlataforma(contrato.clienteId)!;
    const doCliente = ctx.unidades[contrato.clienteId] ?? [];

    // Equipes: só ids de equipes ativas do cadastro, sem repetir.
    const equipeIds = Array.isArray(p.equipeIds) ? [...new Set(p.equipeIds.map(String))] : null;
    if (!equipeIds || equipeIds.some((id) => !equipesAtivas.has(id))) {
      erro("Equipe inválida ou inativa.");
      continue;
    }

    // Estabelecimento: um que já existe do cliente, ou um novo (que, se já existir pelo nome, é o existente).
    let unidadeRef: string;
    let unidadeExistente: UnidadeCtx | undefined;
    if (p.unidade?.tipo === "existente") {
      const idEscolhido = p.unidade.id;
      unidadeExistente = doCliente.find((u) => u.id === idEscolhido);
      if (!unidadeExistente) {
        erro("O estabelecimento escolhido não é deste cliente.");
        continue;
      }
      unidadeRef = unidadeExistente.id;
    } else if (p.unidade?.tipo === "nova") {
      const nome = String(p.unidade.nome ?? "").trim();
      if (!nome || nome.length > LIMITE_NOME) {
        erro(`O nome do estabelecimento novo precisa ter de 1 a ${LIMITE_NOME} caracteres.`);
        continue;
      }
      unidadeExistente = doCliente.find((u) => chaveNome(u.nome) === chaveNome(nome));
      if (unidadeExistente) unidadeRef = unidadeExistente.id;
      else {
        if (!podeCadastrar) {
          erro(semPermissao);
          continue;
        }
        const chave = chaveEstab(contrato.clienteId, nome);
        if (!novasUnidades.has(chave)) novasUnidades.set(chave, { id: crypto.randomUUID(), clienteId: clienteBig, nome });
        unidadeRef = novasUnidades.get(chave)!.id;
      }
    } else {
      erro("Estabelecimento não informado.");
      continue;
    }

    const chave = chaveItem(contrato.id, unidadeRef, equipeIds, p.atividade);
    if (existentes.has(chave) || vistos.has(chave)) {
      ignorados++;
      continue;
    }
    vistos.add(chave);
    const itemId = crypto.randomUUID();
    itens.push({ id: itemId, clienteId: clienteBig, contratoId: contrato.id, estabelecimentoId: unidadeRef, tipo: p.atividade, prazo: new Date(`${p.prazo}T00:00:00Z`), observacao });
    equipesDosItens.push(...equipeIds.map((equipeId) => ({ itemId, equipeId })));
  }

  if (erros.length) return { ok: false, erros: erros.slice(0, 50) };
  if (!itens.length) return { ok: true, criados: 0, ignorados, estabelecimentosCriados: 0 };

  await reports.$transaction(async (tx) => {
    if (novasUnidades.size) await tx.estabelecimento.createMany({ data: [...novasUnidades.values()].map((u) => ({ ...u, endereco: "", latitude: null, longitude: null, raioMetros: RAIO_PADRAO_METROS })) });
    await tx.itemCronograma.createMany({ data: itens });
    if (equipesDosItens.length) await tx.itemCronogramaEquipe.createMany({ data: equipesDosItens });
  });
  return { ok: true, criados: itens.length, ignorados, estabelecimentosCriados: novasUnidades.size };
}
