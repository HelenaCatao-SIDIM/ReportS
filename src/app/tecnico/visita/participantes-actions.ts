"use server";

import { revalidatePath } from "next/cache";
import { exigirTecnicoAcao } from "@/lib/dal";
import { cpfValido, mascararCpf, normalizar, soDigitos } from "@/lib/format";
import { ehPresencial } from "@/lib/visitas";
import { buscarCliente } from "@/lib/repo/clientes";
import { buscarCbo } from "@/lib/repo/cbo";
import { salvarImagem } from "@/lib/repo/arquivos";
import { buscarParticipante, cpfEmUso, criarParticipante, homonimo, listarParticipantes } from "@/lib/repo/participantes";
import { adicionarPresenca, buscarVisita, removerPresenca } from "@/lib/repo/visitas";
import type { Cbo } from "@/lib/types";

async function contexto(visitaId: string) {
  const tecnico = await exigirTecnicoAcao();
  const v = await buscarVisita(visitaId);
  if (!v || v.tecnicoId !== tecnico.id) throw new Error("Visita não encontrada");
  const cliente = await buscarCliente(v.clienteId);
  if (!cliente) throw new Error("Cliente não encontrado");
  // Assinatura só no presencial; treinamento online é sempre nominal.
  const exigeAssinatura = cliente.nivel === "assinado" && ehPresencial(v.tipo);
  return { tecnico, v, cliente, exigeAssinatura };
}

export interface SugestaoParticipante {
  id: string;
  nome: string;
  cbo: Cbo;
  setor: string;
  cpfMascarado: string;
}

/** Participantes do cliente cujo nome contém o termo, fora os que já estão na visita. CPF só mascarado. */
export async function sugerirParticipantes(visitaId: string, termo: string): Promise<SugestaoParticipante[]> {
  const { v } = await contexto(visitaId);
  if (normalizar(termo).length < 2) return [];
  const presentes = new Set(v.presencas.map((p) => p.participanteId));
  const n = normalizar(termo);
  return (await listarParticipantes(v.clienteId))
    .filter((p) => !presentes.has(p.id) && normalizar(p.nome).includes(n))
    .slice(0, 8)
    .map((p) => ({ id: p.id, nome: p.nome, cbo: p.cbo, setor: p.setor, cpfMascarado: p.cpf ? mascararCpf(p.cpf) : "" }));
}

export interface PresencaState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "cbo" | "cpf" | "assinatura" | "geral", string>>;
  pedirHomonimo?: boolean;
}

/**
 * Registra a presença: de um participante já cadastrado (`participanteId`) ou de um novo,
 * que também entra no cadastro do cliente marcado como "criado em campo".
 */
export async function registrarPresenca(visitaId: string, _: PresencaState, fd: FormData): Promise<PresencaState> {
  const { tecnico, v, cliente, exigeAssinatura } = await contexto(visitaId);
  if (v.status !== "em_andamento") return { erros: { geral: "Esta visita já foi encerrada." } };

  const erros: NonNullable<PresencaState["erros"]> = {};
  const assinaturaArquivo = fd.get("assinatura");
  const temAssinatura = assinaturaArquivo instanceof File && assinaturaArquivo.size > 0;
  if (exigeAssinatura && !temAssinatura) erros.assinatura = "Peça para a pessoa assinar no quadro.";

  const existenteId = String(fd.get("participanteId") ?? "");
  let participante = existenteId ? await buscarParticipante(existenteId) : null;
  if (existenteId && (!participante || participante.clienteId !== cliente.id)) return { erros: { geral: "Participante não encontrado." } };
  if (participante && v.presencas.some((p) => p.participanteId === participante!.id)) {
    return { erros: { geral: `${participante.nome} já está na lista.` } };
  }

  if (!participante) {
    const nome = String(fd.get("nome") ?? "").trim();
    const setor = String(fd.get("setor") ?? "").trim();
    const cpf = soDigitos(String(fd.get("cpf") ?? ""));
    const cbo = await buscarCbo(String(fd.get("cbo") ?? ""));

    if (nome.length < 3) erros.nome = "Informe o nome completo.";
    else if (fd.get("homonimo") === null && (await homonimo(cliente.id, nome))) {
      erros.nome = "Já existe alguém com este nome no cadastro. Escolha na lista de sugestões ou confirme que é outra pessoa.";
    }
    if (!cbo) erros.cbo = "Escolha a ocupação (CBO) na lista.";
    if (cliente.exigeCpf) {
      if (!cpfValido(cpf)) erros.cpf = "CPF inválido.";
      else if (await cpfEmUso(cliente.id, cpf)) erros.cpf = "Este CPF já está cadastrado. Busque a pessoa pelo nome.";
    }
    if (Object.keys(erros).length) return { erros, pedirHomonimo: erros.nome?.startsWith("Já existe") };

    participante = await criarParticipante(cliente.id, { nome, cbo: cbo!, setor, cpf: cliente.exigeCpf ? cpf : null }, true);
  } else if (Object.keys(erros).length) {
    return { erros };
  }

  let assinatura: string | null = null;
  if (exigeAssinatura) {
    const img = await salvarImagem(assinaturaArquivo as File);
    if (!img) return { erros: { assinatura: "Não foi possível salvar a assinatura. Tente de novo." } };
    assinatura = img.url;
  }

  await adicionarPresenca(visitaId, tecnico.id, {
    participanteId: participante.id,
    nome: participante.nome,
    cbo: participante.cbo,
    setor: participante.setor,
    cpf: participante.cpf,
    confirmacao: exigeAssinatura ? "assinatura" : "nominal",
    assinatura,
  });
  revalidatePath(`/tecnico/visita/${visitaId}`);
  revalidatePath("/admin/participantes");
  revalidatePath("/admin/visitas", "layout");
  return { ok: true };
}

export async function retirarPresenca(visitaId: string, participanteId: string): Promise<string | null> {
  const { tecnico, v } = await contexto(visitaId);
  if (v.status !== "em_andamento") return "Esta visita já foi encerrada.";
  await removerPresenca(visitaId, tecnico.id, participanteId);
  revalidatePath(`/tecnico/visita/${visitaId}`);
  revalidatePath("/admin/visitas", "layout");
  return null;
}
