"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissaoAcao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { cpfValido, mascararCpf, normalizar, soDigitos } from "@/lib/format";
import { ehPresencial } from "@/lib/visitas";
import { podeMostrarDonoDoCpf } from "@/lib/regras-visita";
import { buscarContrato } from "@/lib/repo/contratos";
import { buscarCbo } from "@/lib/repo/cbo";
import { salvarImagem } from "@/lib/repo/arquivos";
import { buscarParticipante, buscarSemelhantes, criarProvisorio, definirCpfDoParticipante, listarParticipantes } from "@/lib/repo/participantes";
import { adicionarPresenca, buscarVisita, removerPresenca } from "@/lib/repo/visitas";
import { configLoginDoSistema } from "@/lib/repo/presenca-login";
import { assinarProva, bloqueadoPorFalhas, conferirProva, limparFalhas, loginNoSaude, mesmaPessoa, registrarFalha } from "@/lib/saude-login";
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
  /** O cadastro tem o id do Saúde, então dá para validar a presença por login. Só o fato: o id não sai do servidor. */
  ligadoAoSaude: boolean;
}

const sugestao = (p: Participante): SugestaoParticipante => ({
  id: p.id,
  nome: p.nome,
  estado: p.estado,
  cbo: p.cbo,
  setor: p.setor,
  cpfMascarado: p.cpf ? mascararCpf(p.cpf) : "",
  ligadoAoSaude: !!p.idErp,
});

export interface ResultadoBusca {
  sugestoes: SugestaoParticipante[];
  /** Nomes que combinam com o termo e já assinaram nesta visita (para a pessoa saber que não precisa assinar de novo). */
  jaNaLista: string[];
}

/** Participantes do sistema do cliente cujo nome contém o termo, fora os que já estão na visita. CPF só mascarado. */
export async function sugerirParticipantes(visitaId: string, termo: string): Promise<ResultadoBusca> {
  const { v, sistemaDoClienteId } = await contexto(visitaId);
  if (normalizar(termo).length < 2) return { sugestoes: [], jaNaLista: [] };
  const presentes = new Set(v.presencas.map((p) => p.participanteId));
  const n = normalizar(termo);
  return {
    sugestoes: (await listarParticipantes(sistemaDoClienteId))
      .filter((p) => !presentes.has(p.id) && normalizar(p.nome).includes(n))
      .slice(0, 8)
      .map(sugestao),
    jaNaLista: v.presencas.filter((p) => normalizar(p.nome).includes(n)).map((p) => p.nome),
  };
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

  // Com o login do participante ligado no tenant, a presença só vale com a prova do login dele (ou com a do técnico, "sem login").
  // A prova é assinada pelo servidor: o navegador não decide sozinho que o login passou.
  let validacao: "login_saude" | "sem_login" | null = null;
  if (await configLoginDoSistema(sistemaDoClienteId)) {
    const idEscolhido = String(fd.get("participanteId") ?? "");
    if (idEscolhido && (await conferirProva(String(fd.get("prova") ?? ""), { finalidade: "login_saude", visitaId, participanteId: idEscolhido }))) validacao = "login_saude";
    else if (await conferirProva(String(fd.get("provaTecnico") ?? ""), { finalidade: "sem_login", visitaId })) validacao = "sem_login";
    else return { erros: { geral: "Entre com o seu usuário e a senha do Saúde antes de confirmar a presença. Se não conseguir, chame o técnico." } };
  }

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

  // RN-PL-35: com CPF no contrato, a presença exige o CPF. Participante já cadastrado sem CPF (como os confirmados, que vêm
  // do ERP sem CPF) informa agora, e o CPF fica no cadastro dele. CPF que é de outra pessoa do sistema bloqueia.
  let cpfNovo: string | null = null;
  if (participante && exigeCpf && !participante.cpf) {
    const informado = soDigitos(String(fd.get("cpf") ?? ""));
    if (!informado) {
      erros.cpf = "Informe o seu CPF.";
    } else if (!cpfValido(informado)) {
      erros.cpf = "CPF inválido. Confira os números.";
    } else {
      const achados = await buscarSemelhantes(sistemaDoClienteId, { nome: participante.nome, cpf: informado }, participante.id);
      if (achados.mesmoCpf) {
        // Quem assina é o próprio participante: o nome do dono do CPF só aparece se for parecido com o dele (veja podeMostrarDonoDoCpf).
        if (podeMostrarDonoDoCpf(participante.nome, achados.mesmoCpf.nome)) {
          return {
            erros: { cpf: `Este CPF já está no cadastro de ${achados.mesmoCpf.nome}. Se é você, toque em “É esta pessoa”.` },
            existente: sugestao(achados.mesmoCpf),
          };
        }
        return { erros: { cpf: "Este CPF já está em outro cadastro. Confira o número ou chame o técnico." } };
      }
      cpfNovo = informado;
    }
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
      if (podeMostrarDonoDoCpf(nome, achados.mesmoCpf.nome)) {
        return {
          erros: { cpf: `Este CPF já está no cadastro de ${achados.mesmoCpf.nome}. Se é você, toque em “É esta pessoa”.` },
          existente: sugestao(achados.mesmoCpf),
        };
      }
      return { erros: { cpf: "Este CPF já está em outro cadastro. Confira o número ou chame o técnico." } };
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

  // Só depois de tudo conferido (assinatura incluída) o CPF informado vai para o cadastro do participante.
  if (cpfNovo && participante) {
    await definirCpfDoParticipante(participante.id, cpfNovo);
    participante = { ...participante, cpf: cpfNovo };
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
    validacao,
  });
  revalidatePath(`/tecnico/visita/${visitaId}`);
  revalidatePath(`/tecnico/visita/${visitaId}/presenca`);
  revalidatePath("/admin/participantes");
  revalidatePath("/admin/visitas", "layout");
  return { ok: true };
}

export type ResultadoEntrada = { ok: true; prova: string } | { ok: false; erro: string };

/**
 * Login do participante no Saúde, antes da assinatura. Confere se o usuário e a senha são da pessoa escolhida (o `userId` da API
 * é o id do Saúde dela) e devolve uma prova assinada, válida por 10 minutos, que a presença exige. A senha só passa pela memória:
 * não é gravada nem registrada. Passou de 5 falhas da pessoa (ou 30 da visita) em 10 minutos, manda chamar o técnico.
 */
export async function entrarNoSaude(visitaId: string, participanteId: string, fd: FormData): Promise<ResultadoEntrada> {
  // Usuário e senha chegam num FormData, e não como argumentos soltos: o servidor de desenvolvimento do Next imprime no terminal
  // os argumentos de cada Server Action, e a senha não pode aparecer lá.
  const usuario = fd.get("usuario");
  const senha = fd.get("senha");
  const { v, sistemaDoClienteId } = await contexto(visitaId);
  if (v.status !== "em_andamento") return { ok: false, erro: "Esta visita já foi encerrada." };
  const cfg = await configLoginDoSistema(sistemaDoClienteId);
  if (!cfg) return { ok: false, erro: "O login do Saúde não está ligado para este cliente." };

  const participante = await buscarParticipante(String(participanteId));
  if (!participante || participante.sistemaDoClienteId !== sistemaDoClienteId) return { ok: false, erro: "Participante não encontrado." };
  if (v.presencas.some((p) => p.participanteId === participante.id)) return { ok: false, erro: "Esta presença já foi confirmada." };
  if (!participante.idErp) return { ok: false, erro: "Seu cadastro ainda não está ligado ao Saúde. Chame o técnico." };
  if (bloqueadoPorFalhas(visitaId, participante.id)) return { ok: false, erro: "Muitas tentativas. Chame o técnico." };

  const u = typeof usuario === "string" ? usuario.trim() : "";
  const s = typeof senha === "string" ? senha : "";
  if (!u || !s) return { ok: false, erro: "Informe o usuário e a senha do Saúde." };
  if (u.length > 100 || s.length > 200) return { ok: false, erro: "Usuário ou senha incorretos." };

  const r = await loginNoSaude(cfg, u, s);
  if (!r.ok) {
    if (r.motivo === "credenciais") {
      registrarFalha(visitaId, participante.id);
      return { ok: false, erro: "Usuário ou senha incorretos." };
    }
    return { ok: false, erro: "Não foi possível falar com o Saúde agora. Tente de novo ou chame o técnico." };
  }
  if (!mesmaPessoa(r.userId, participante.idErp)) {
    registrarFalha(visitaId, participante.id);
    return { ok: false, erro: "Este usuário não é o da pessoa escolhida. Confira o nome." };
  }
  limparFalhas(visitaId, participante.id);
  return { ok: true, prova: await assinarProva({ finalidade: "login_saude", visitaId, participanteId: participante.id }, 10) };
}

export async function retirarPresenca(visitaId: string, participanteId: string): Promise<string | null> {
  const { tecnico, v } = await contexto(visitaId);
  if (v.status !== "em_andamento") return "Esta visita já foi encerrada.";
  await removerPresenca(visitaId, tecnico.id, participanteId);
  revalidatePath(`/tecnico/visita/${visitaId}`);
  revalidatePath(`/tecnico/visita/${visitaId}/presenca`);
  revalidatePath("/admin/visitas", "layout");
  return null;
}
