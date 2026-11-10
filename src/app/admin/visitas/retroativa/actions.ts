"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { deInputLocal } from "@/lib/datas";
import { mascararCpf, normalizar } from "@/lib/format";
import { ehPresencial, TIPOS_VISITA } from "@/lib/visitas";
import { equipesDaVisita, exigeParticipantes, sugereTemasPorEquipe } from "@/lib/regras-visita";
import { buscarUnidade } from "@/lib/repo/clientes";
import { buscarContrato } from "@/lib/repo/contratos";
import { listarEquipes } from "@/lib/repo/equipes";
import { listarTemas } from "@/lib/repo/temas";
import { listarComPermissao } from "@/lib/repo/usuarios";
import { buscarParticipante, listarParticipantes } from "@/lib/repo/participantes";
import { salvarImagem } from "@/lib/repo/arquivos";
import { lancarVisitaRetroativa, tecnicoOcupadoNoHorario } from "@/lib/repo/visitas";
import type { Foto, PresencaVisita, TipoVisita } from "@/lib/types";

/*
 * Lançamento retroativo: a Administração registra uma visita que já aconteceu. Igual a uma visita normal, menos o que
 * depende de estar no local na hora: os horários são digitados, não há GPS nem raio, a foto é opcional e a presença
 * não tem assinatura nem login do participante (os participantes são marcados do cadastro).
 */

const LIMITE_TEXTO = 2000;
const LIMITE_FOTOS = 10;

type Campo = "contrato" | "unidade" | "tecnico" | "tipo" | "data" | "entrada" | "saida" | "equipes" | "participantes" | "lista" | "fotos" | "motivo" | "geral";

export interface RetroativaState {
  erros?: Partial<Record<Campo, string>>;
}

export interface ParticipanteOpcao {
  id: string;
  nome: string;
  ocupacao: string;
  setor: string;
  cpfMascarado: string;
}

/** Participantes do sistema do cliente do contrato cujo nome contém o termo (para marcar na presença). CPF só mascarado. */
export async function buscarParticipantesRetroativa(contratoId: string, termo: string): Promise<ParticipanteOpcao[]> {
  await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  const n = normalizar(termo);
  if (n.length < 2) return [];
  const contrato = await buscarContrato(contratoId);
  if (!contrato) return [];
  return (await listarParticipantes(contrato.sistemaDoClienteId))
    .filter((p) => normalizar(p.nome).includes(n))
    .slice(0, 10)
    .map((p) => ({ id: p.id, nome: p.nome, ocupacao: p.cbo?.titulo ?? "", setor: p.setor, cpfMascarado: p.cpf ? mascararCpf(p.cpf) : "" }));
}

const arquivos = (fd: FormData, nome: string) => fd.getAll(nome).filter((f): f is File => f instanceof File && f.size > 0);

export async function lancarRetroativa(_: RetroativaState, fd: FormData): Promise<RetroativaState> {
  const autor = await exigirPermissaoAcao(PERMISSOES.visitasGerenciar);
  const texto = (k: string) => String(fd.get(k) ?? "").trim();

  const contratoId = texto("contratoId");
  const unidadeId = texto("unidadeId");
  const tecnicoId = texto("tecnicoId");
  const tipo = texto("tipo") as TipoVisita;
  const data = texto("data");
  const motivo = texto("motivo");
  const erros: NonNullable<RetroativaState["erros"]> = {};

  const contrato = contratoId ? await buscarContrato(contratoId) : null;
  if (!contrato) erros.contrato = "Escolha o cliente e o sistema.";
  const unidade = unidadeId ? await buscarUnidade(unidadeId) : null;
  if (!unidade || (contrato && unidade.clienteId !== contrato.clienteId)) erros.unidade = "Escolha um estabelecimento do cliente.";
  const tecnicos = await listarComPermissao(PERMISSOES.tecnico);
  if (!tecnicos.some((t) => t.id === tecnicoId)) erros.tecnico = "Escolha o técnico que fez a visita.";
  if (!TIPOS_VISITA.some((t) => t.valor === tipo)) erros.tipo = "Escolha o tipo de visita.";

  // Horários de Brasília: a data e as horas de entrada e saída.
  const entrada = /^\d{4}-\d{2}-\d{2}$/.test(data) ? deInputLocal(`${data}T${texto("horaEntrada")}`) : null;
  const saida = /^\d{4}-\d{2}-\d{2}$/.test(data) ? deInputLocal(`${data}T${texto("horaSaida")}`) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erros.data = "Informe a data da visita.";
  else if (!entrada) erros.entrada = "Informe a hora de entrada.";
  else if (!saida) erros.saida = "Informe a hora de saída.";
  else if (saida <= entrada) erros.saida = "A saída precisa ser depois da entrada.";
  else if (new Date(saida).getTime() > Date.now()) erros.saida = "A visita precisa já ter acontecido: a saída não pode estar no futuro.";
  else if (tecnicos.some((t) => t.id === tecnicoId) && (await tecnicoOcupadoNoHorario(tecnicoId, entrada, saida)))
    erros.entrada = "O técnico já tem outra visita nesse horário.";

  // Equipes: as mesmas regras do check-in (implantação e treinamentos; obrigatórias quando há equipe ativa).
  let equipeIds: string[] = [];
  if (sugereTemasPorEquipe(tipo)) {
    const validas = new Set(equipesDaVisita(await listarEquipes(), []).map((e) => e.id));
    equipeIds = [...new Set(fd.getAll("equipeIds").map(String))].filter((id) => validas.has(id));
    if (validas.size && !equipeIds.length) erros.equipes = "Marque as equipes treinadas.";
  }

  // Participantes do cadastro do sistema do cliente, sem assinatura.
  const presencas: PresencaVisita[] = [];
  if (contrato) {
    for (const id of new Set(fd.getAll("participanteIds").map(String))) {
      const p = await buscarParticipante(id);
      if (!p || p.sistemaDoClienteId !== contrato.sistemaDoClienteId) continue;
      presencas.push({ participanteId: p.id, estado: p.estado, nome: p.nome, cbo: p.cbo, setor: p.setor, cpf: p.cpf, confirmacao: "nominal", assinatura: null, validacao: null });
    }
  }
  // A presença pode vir dos nomes marcados, da foto da lista em papel, ou dos dois.
  const listaArquivos = arquivos(fd, "listaPresenca");
  if (TIPOS_VISITA.some((t) => t.valor === tipo) && exigeParticipantes(tipo) && !presencas.length && !listaArquivos.length)
    erros.participantes = "Treinamento precisa de participantes: marque ao menos um ou anexe a foto da lista de presença.";

  const fotosArquivos = arquivos(fd, "fotos");
  if (fotosArquivos.length + listaArquivos.length > LIMITE_FOTOS) erros.fotos = `Envie no máximo ${LIMITE_FOTOS} imagens, somando as fotos e a lista de presença.`;
  if (motivo.length < 5) erros.motivo = "Informe o motivo do lançamento (fica no histórico).";
  if (["observacoes", "pendencias", "proximosPassos", "temaAdicional"].some((k) => texto(k).length > LIMITE_TEXTO)) erros.geral = `Os textos podem ter até ${LIMITE_TEXTO} caracteres.`;
  if (Object.keys(erros).length) return { erros };

  const fotos: Foto[] = [];
  for (const f of listaArquivos) {
    const foto = await salvarImagem(f);
    if (!foto) return { erros: { lista: "Uma das imagens da lista é inválida ou muito grande." } };
    fotos.push({ ...foto, legenda: "lista_presenca" });
  }
  for (const f of fotosArquivos) {
    const foto = await salvarImagem(f);
    if (!foto) return { erros: { fotos: "Uma das fotos é inválida ou muito grande." } };
    fotos.push(foto);
  }

  // Só temas ativos do sistema do contrato.
  const permitidos = new Set((await listarTemas()).filter((t) => t.sistema === contrato!.sistema && t.ativo).map((t) => t.id));
  const id = await lancarVisitaRetroativa(
    {
      tecnicoId,
      clienteId: contrato!.clienteId,
      contratoId: contrato!.id,
      unidadeId,
      tipo,
      entrada: entrada!,
      saida: saida!,
      linkReuniao: ehPresencial(tipo) ? null : texto("linkReuniao") || null,
      equipeIds,
      temaIds: fd.getAll("temaIds").map(String).filter((t) => permitidos.has(t)),
      temaAdicional: texto("temaAdicional"),
      observacoes: texto("observacoes"),
      pendencias: texto("pendencias"),
      proximosPassos: texto("proximosPassos"),
      fotos,
      presencas,
    },
    autor,
    motivo,
  );
  revalidatePath("/admin/visitas", "layout");
  revalidatePath("/admin/cronograma");
  redirect(`/admin/visitas/${id}?ok=lancada`);
}
