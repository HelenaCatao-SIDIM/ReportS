/** Rótulos e opções compartilhados entre telas de clientes, contratos e relatórios. */
import type { EstadoSistemaCliente, NivelComprovacao, TipoRelatorioAtendimentos } from "@/lib/types";

export const ROTULO_ESTADO: Record<EstadoSistemaCliente, string> = {
  em_implantacao: "Em implantação",
  sem_cliente: "Sem cliente",
  vinculado: "Vinculado",
};

/** Comprovação da presença: o contrato marca uma só; `requerLogin` só pode ser escolhida onde o sistema tem login (Saúde). */
export const NIVEIS: { valor: NivelComprovacao; titulo: string; descricao: string; requerLogin?: boolean }[] = [
  { valor: "nominal", titulo: "Nominal", descricao: "Basta a lista de participantes com nome e CBO." },
  { valor: "assinado", titulo: "Assinado", descricao: "Cada participante assina com o dedo na tela do celular do técnico." },
  { valor: "login", titulo: "Login", descricao: "Cada participante confirma a presença entrando com o próprio login do Saúde (sem assinatura).", requerLogin: true },
];

export const NIVEIS_VALIDOS = new Set<NivelComprovacao>(NIVEIS.map((n) => n.valor));

/** Opções que o contrato de um sistema pode marcar: Login só aparece onde o sistema tem login. */
export const niveisDisponiveis = (suportaLogin: boolean) => NIVEIS.filter((n) => !n.requerLogin || suportaLogin);

const ROTULO_NIVEL: Record<NivelComprovacao, string> = { nominal: "Nominal", assinado: "Assinado", login: "Login" };
export const rotuloNivel = (n: NivelComprovacao) => ROTULO_NIVEL[n] ?? "Nominal";

export const TIPOS_RELATORIO_ATENDIMENTOS: { valor: TipoRelatorioAtendimentos; titulo: string; descricao: string }[] = [
  { valor: "sintetico", titulo: "Sintético", descricao: "Só o painel de resumo: total, espera média, atendimento médio, tempo total e contagem por tabulação." },
  { valor: "analitico", titulo: "Analítico", descricao: "O painel de resumo e a lista de todos os atendimentos (início e fim, tempo, solicitante, técnico, assunto e tabulação), no PDF." },
];

export const rotuloTipoRelatorioAtendimentos = (t: TipoRelatorioAtendimentos | undefined) => (t === "analitico" ? "Analítico" : "Sintético");
