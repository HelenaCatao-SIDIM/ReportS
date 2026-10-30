/** Rótulos e opções compartilhados entre telas de clientes, contratos e relatórios. */
import type { EstadoSistemaCliente, NivelComprovacao } from "@/lib/types";

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
