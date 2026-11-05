/** Rótulos e opções compartilhados entre telas de clientes, contratos e relatórios. */
import type { EstadoSistemaCliente, NivelComprovacao, TipoRelatorioAtendimentos } from "@/lib/types";

export const ROTULO_ESTADO: Record<EstadoSistemaCliente, string> = {
  em_implantacao: "Em implantação",
  sem_cliente: "Sem cliente",
  vinculado: "Vinculado",
};

export const NIVEIS: { valor: NivelComprovacao; titulo: string; descricao: string }[] = [
  { valor: "nominal", titulo: "Nominal", descricao: "Basta a lista de participantes com nome e CBO (o setor é opcional)." },
  { valor: "assinado", titulo: "Assinado", descricao: "Cada participante assina com o dedo na tela do celular do técnico." },
];

export const rotuloNivel = (n: NivelComprovacao) => (n === "assinado" ? "Assinado" : "Nominal");

export const TIPOS_RELATORIO_ATENDIMENTOS: { valor: TipoRelatorioAtendimentos; titulo: string; descricao: string }[] = [
  { valor: "sintetico", titulo: "Sintético", descricao: "Só o painel de resumo: total, espera média, atendimento médio, tempo total e contagem por tabulação." },
  { valor: "analitico", titulo: "Analítico", descricao: "O painel de resumo e a lista de todos os atendimentos (início e fim, tempo, solicitante, técnico, assunto e tabulação), no PDF." },
];

export const rotuloTipoRelatorioAtendimentos = (t: TipoRelatorioAtendimentos | undefined) => (t === "analitico" ? "Analítico" : "Sintético");
