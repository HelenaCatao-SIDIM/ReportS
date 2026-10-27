"use server";

import { revalidatePath } from "next/cache";
import { exigirGestorAcao } from "@/lib/dal";
import { cpfValido, normalizar, soDigitos } from "@/lib/format";
import { buscarCliente } from "@/lib/repo/clientes";
import { buscarCbo } from "@/lib/repo/cbo";
import { atualizarParticipante, buscarParticipante, cpfEmUso, criarParticipante, homonimo } from "@/lib/repo/participantes";
import type { Cbo } from "@/lib/types";

export interface ParticipanteFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "cbo" | "cpf", string>>;
  /** Já existe alguém com o mesmo nome: o formulário pede confirmação de que é outra pessoa. */
  pedirHomonimo?: boolean;
  valores?: { nome: string; cbo: Cbo | null; setor: string; cpf: string };
}

/** Cria (participanteId null) ou edita um participante do cliente. */
export async function salvarParticipante(
  clienteId: string,
  participanteId: string | null,
  _: ParticipanteFormState,
  fd: FormData,
): Promise<ParticipanteFormState> {
  await exigirGestorAcao();
  const cliente = await buscarCliente(clienteId);
  if (!cliente) throw new Error("Cliente não encontrado");

  const nome = String(fd.get("nome") ?? "").trim();
  const setor = String(fd.get("setor") ?? "").trim();
  const cpf = soDigitos(String(fd.get("cpf") ?? ""));
  // O título vem da tabela, não do navegador.
  const cbo = await buscarCbo(String(fd.get("cbo") ?? ""));
  const excetoId = participanteId ?? undefined;
  // Na edição, só pergunta sobre homônimo se o nome mudou.
  const atual = participanteId ? await buscarParticipante(participanteId) : null;
  const nomeMudou = !atual || normalizar(atual.nome) !== normalizar(nome);
  const confirmouHomonimo = fd.get("homonimo") !== null || !nomeMudou;

  const erros: NonNullable<ParticipanteFormState["erros"]> = {};
  let pedirHomonimo = false;
  if (nome.length < 3) erros.nome = "Informe o nome completo.";
  else if (!confirmouHomonimo && (await homonimo(clienteId, nome, excetoId))) {
    erros.nome = "Já existe um participante com este nome neste cliente.";
    pedirHomonimo = true;
  }
  if (!cbo) erros.cbo = "Escolha a ocupação (CBO) na lista.";
  if (cliente.exigeCpf) {
    if (!cpfValido(cpf)) erros.cpf = "CPF inválido.";
    else if (await cpfEmUso(clienteId, cpf, excetoId)) erros.cpf = "Já existe um participante com este CPF neste cliente.";
  }
  if (Object.keys(erros).length) return { erros, pedirHomonimo, valores: { nome, cbo, setor, cpf } };

  const dados = { nome, cbo: cbo!, setor, cpf: cliente.exigeCpf ? cpf : null };
  if (participanteId) await atualizarParticipante(participanteId, dados);
  else await criarParticipante(clienteId, dados);
  revalidatePath("/admin/participantes");
  return { ok: true };
}
