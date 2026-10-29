"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { cpfValido, soDigitos } from "@/lib/format";
import { buscarSistemaDoCliente } from "@/lib/repo/clientes";
import { buscarContratoDoSistemaDoCliente } from "@/lib/repo/contratos";
import { buscarCbo } from "@/lib/repo/cbo";
import { atualizarParticipante, buscarParticipante, buscarSemelhantes, criarProvisorio } from "@/lib/repo/participantes";
import type { Cbo, EstadoParticipante, Participante } from "@/lib/types";

/** Quem já existe no sistema do cliente, para mostrar no aviso. */
export interface ParecidoNoCadastro {
  id: string;
  nome: string;
  estado: EstadoParticipante;
  cbo: Cbo;
  setor: string;
}

const parecido = (p: Participante): ParecidoNoCadastro => ({ id: p.id, nome: p.nome, estado: p.estado, cbo: p.cbo, setor: p.setor });

export interface ParticipanteFormState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "cbo" | "cpf", string>>;
  /** O CPF já é de alguém neste sistema do cliente: o cadastro não é criado. */
  existente?: ParecidoNoCadastro;
  /** Nomes iguais ou parecidos: confirmar que é outra pessoa para cadastrar mesmo assim. */
  semelhantes?: ParecidoNoCadastro[];
  valores?: { nome: string; cbo: Cbo | null; setor: string; cpf: string };
}

/**
 * Cria (participanteId null) um participante provisório ou edita um participante do sistema do cliente.
 * Antes de criar, procura quem já tem o mesmo CPF ou um nome igual ou parecido (RN-PL-34). O nome do confirmado
 * vem do ERP e não é editado aqui; CBO, setor e CPF são do ReportS (RN-PL-42).
 */
export async function salvarParticipante(
  sistemaDoClienteId: string,
  participanteId: string | null,
  _: ParticipanteFormState,
  fd: FormData,
): Promise<ParticipanteFormState> {
  await exigirPermissaoAcao(PERMISSOES.participantesGerenciar);
  const sdc = await buscarSistemaDoCliente(sistemaDoClienteId);
  if (!sdc) throw new Error("Sistema do cliente não encontrado");
  // O CPF segue o contrato deste sistema.
  const exigeCpf = (await buscarContratoDoSistemaDoCliente(sistemaDoClienteId))?.exigeCpf ?? false;

  const atual = participanteId ? await buscarParticipante(participanteId) : null;
  if (participanteId && (!atual || atual.sistemaDoClienteId !== sistemaDoClienteId)) throw new Error("Participante não encontrado");

  // O nome do confirmado vem do ERP: o que vier do formulário é ignorado.
  const nome = atual?.estado === "confirmado" ? atual.nome : String(fd.get("nome") ?? "").trim();
  const setor = String(fd.get("setor") ?? "").trim();
  const cpf = soDigitos(String(fd.get("cpf") ?? ""));
  // O título vem da tabela, não do navegador.
  const cbo = await buscarCbo(String(fd.get("cbo") ?? ""));
  const valores = { nome, cbo, setor, cpf };

  const erros: NonNullable<ParticipanteFormState["erros"]> = {};
  if (nome.length < 3) erros.nome = "Informe o nome completo.";
  if (!cbo) erros.cbo = "Escolha a ocupação (CBO) na lista.";
  if (exigeCpf && !cpfValido(cpf)) erros.cpf = "CPF inválido.";
  if (Object.keys(erros).length) return { erros, valores };

  // Busca antes de criar (e antes de mudar CPF ou nome de um provisório).
  const nomeMudou = !atual || atual.nome !== nome;
  const achados = await buscarSemelhantes(sistemaDoClienteId, { nome, cpf: exigeCpf ? cpf : null }, participanteId ?? undefined);
  if (achados.mesmoCpf) {
    return {
      erros: { cpf: `Este CPF já está cadastrado em ${achados.mesmoCpf.nome}. ${atual ? "Cada CPF é de uma pessoa só neste sistema." : "O cadastro não foi criado."}` },
      existente: parecido(achados.mesmoCpf),
      valores,
    };
  }
  if (nomeMudou && achados.nomesParecidos.length && fd.get("homonimo") === null) {
    return {
      erros: { nome: "Já existe alguém com nome igual ou parecido. Confira se é a mesma pessoa." },
      semelhantes: achados.nomesParecidos.map(parecido),
      valores,
    };
  }

  const dados = { nome, cbo: cbo!, setor, cpf: exigeCpf ? cpf : null };
  if (participanteId) await atualizarParticipante(participanteId, dados);
  else await criarProvisorio(sistemaDoClienteId, dados, "cadastro_reports");
  revalidatePath("/admin/participantes");
  return { ok: true };
}
