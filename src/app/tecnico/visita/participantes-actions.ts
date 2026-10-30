"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { cpfValido, mascararCpf, normalizar, soDigitos } from "@/lib/format";
import { ehPresencial } from "@/lib/visitas";
import { buscarContrato } from "@/lib/repo/contratos";
import { buscarCbo } from "@/lib/repo/cbo";
import { salvarImagem } from "@/lib/repo/arquivos";
import { buscarParticipante, buscarSemelhantes, criarProvisorio, listarParticipantes } from "@/lib/repo/participantes";
import { adicionarPresenca, buscarVisita, removerPresenca } from "@/lib/repo/visitas";
import type { Cbo, EstadoParticipante, Participante } from "@/lib/types";

async function contexto(visitaId: string) {
  const tecnico = await exigirPermissaoAcao(PERMISSOES.tecnico);
  const v = await buscarVisita(visitaId);
  if (!v || v.tecnicoId !== tecnico.id) throw new Error("Visita não encontrada");
  const contrato = await buscarContrato(v.contratoId);
  if (!contrato) throw new Error("Contrato não encontrado");
  // A forma de comprovação e o CPF seguem o contrato da visita. Assinatura só no presencial; treinamento online é sempre nominal.
  const exigeAssinatura = contrato.nivel === "assinado" && ehPresencial(v.tipo);
  // Os participantes são do sistema do cliente do contrato (a mesma pessoa pode ter cadastros diferentes em cada sistema).
  return { tecnico, v, sistemaDoClienteId: contrato.sistemaDoClienteId, exigeAssinatura, exigeCpf: contrato.exigeCpf };
}

export interface SugestaoParticipante {
  id: string;
  nome: string;
  estado: EstadoParticipante;
  cbo: Cbo | null;
  setor: string;
  cpfMascarado: string;
}

const sugestao = (p: Participante): SugestaoParticipante => ({
  id: p.id,
  nome: p.nome,
  estado: p.estado,
  cbo: p.cbo,
  setor: p.setor,
  cpfMascarado: p.cpf ? mascararCpf(p.cpf) : "",
});

/** Participantes do sistema do cliente cujo nome contém o termo, fora os que já estão na visita. CPF só mascarado. */
export async function sugerirParticipantes(visitaId: string, termo: string): Promise<SugestaoParticipante[]> {
  const { v, sistemaDoClienteId } = await contexto(visitaId);
  if (normalizar(termo).length < 2) return [];
  const presentes = new Set(v.presencas.map((p) => p.participanteId));
  const n = normalizar(termo);
  return (await listarParticipantes(sistemaDoClienteId))
    .filter((p) => !presentes.has(p.id) && normalizar(p.nome).includes(n))
    .slice(0, 8)
    .map(sugestao);
}

export interface PresencaState {
  ok?: boolean;
  erros?: Partial<Record<"nome" | "cbo" | "cpf" | "assinatura" | "geral", string>>;
  /** O CPF já é de alguém no sistema do cliente: a criação é bloqueada e o técnico usa essa pessoa. */
  existente?: SugestaoParticipante;
  /** Nomes iguais ou parecidos: "É esta pessoa?". Só cria um novo depois de o técnico confirmar que não é. */
  semelhantes?: SugestaoParticipante[];
}

/**
 * Registra a presença: de um participante já cadastrado (`participanteId`) ou de um novo, que entra no cadastro
 * do sistema do cliente como provisório ("campo_reports"), depois da busca por CPF e por nome (RN-PL-34).
 */
export async function registrarPresenca(visitaId: string, _: PresencaState, fd: FormData): Promise<PresencaState> {
  const { tecnico, v, sistemaDoClienteId, exigeAssinatura, exigeCpf } = await contexto(visitaId);
  if (v.status !== "em_andamento") return { erros: { geral: "Esta visita já foi encerrada." } };

  const erros: NonNullable<PresencaState["erros"]> = {};
  const assinaturaArquivo = fd.get("assinatura");
  const temAssinatura = assinaturaArquivo instanceof File && assinaturaArquivo.size > 0;
  if (exigeAssinatura && !temAssinatura) erros.assinatura = "Peça para a pessoa assinar no quadro.";

  const existenteId = String(fd.get("participanteId") ?? "");
  let participante = existenteId ? await buscarParticipante(existenteId) : null;
  if (existenteId && (!participante || participante.sistemaDoClienteId !== sistemaDoClienteId)) return { erros: { geral: "Participante não encontrado." } };
  if (participante && v.presencas.some((p) => p.participanteId === participante!.id)) {
    return { erros: { geral: `${participante.nome} já está na lista.` } };
  }

  if (!participante) {
    const nome = String(fd.get("nome") ?? "").trim();
    const setor = String(fd.get("setor") ?? "").trim();
    const cpf = soDigitos(String(fd.get("cpf") ?? ""));
    const cbo = await buscarCbo(String(fd.get("cbo") ?? ""));

    if (nome.length < 3) erros.nome = "Informe o nome completo.";
    if (!cbo) erros.cbo = "Escolha a ocupação (CBO) na lista.";
    if (exigeCpf && !cpfValido(cpf)) erros.cpf = "CPF inválido.";
    if (Object.keys(erros).length) return { erros };

    // Busca antes de criar: CPF igual bloqueia; nome igual ou parecido pede a confirmação de que é outra pessoa.
    const achados = await buscarSemelhantes(sistemaDoClienteId, { nome, cpf: exigeCpf ? cpf : null });
    if (achados.mesmoCpf) {
      return {
        erros: { cpf: `Este CPF já está cadastrado em ${achados.mesmoCpf.nome}. Use essa pessoa em vez de cadastrar de novo.` },
        existente: sugestao(achados.mesmoCpf),
      };
    }
    if (achados.nomesParecidos.length && fd.get("homonimo") === null) {
      return { erros: { nome: "Já existe alguém com nome igual ou parecido. Confira se é a mesma pessoa." }, semelhantes: achados.nomesParecidos.map(sugestao) };
    }

    participante = await criarProvisorio(sistemaDoClienteId, { nome, cbo: cbo!, setor, cpf: exigeCpf ? cpf : null }, "campo_reports", tecnico.id);
  } else if (Object.keys(erros).length) {
    return { erros };
  }

  let assinatura: string | null = null;
  if (exigeAssinatura) {
    const img = await salvarImagem(assinaturaArquivo as File);
    if (!img) return { erros: { assinatura: "Não foi possível salvar a assinatura. Tente de novo." } };
    assinatura = img.url;
  }

  // Quem não tem setor no cadastro entra na lista com o setor da visita (só na presença; o cadastro não muda).
  const setorDaVisita = v.setorNome === "—" ? "" : v.setorNome;

  await adicionarPresenca(visitaId, tecnico.id, {
    participanteId: participante.id,
    estado: participante.estado,
    nome: participante.nome,
    cbo: participante.cbo,
    setor: participante.setor || setorDaVisita,
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
