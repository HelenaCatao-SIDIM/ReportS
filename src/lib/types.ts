export type Perfil = "gestor" | "tecnico";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  perfil: Perfil;
  ativo: boolean;
}

/** Dados do usuário que podem ir para a tela (sem o hash da senha). */
export type UsuarioPublico = Omit<Usuario, "senhaHash">;

export type NivelComprovacao = "nominal" | "assinado";

export interface Aprovador {
  id: string;
  nome: string;
  cargo: string;
  email: string;
}

export interface Cliente {
  id: string;
  nome: string;
  /** Somente dígitos (14). */
  cnpj: string;
  /** Texto usado na capa do relatório. */
  contrato: string;
  nivel: NivelComprovacao;
  exigeCpf: boolean;
  ativo: boolean;
  aprovadores: Aprovador[];
}

export interface Unidade {
  id: string;
  clienteId: string;
  nome: string;
  endereco: string;
  /** Digitadas à mão; com elas, o check-in presencial grava a distância até a unidade. */
  latitude: number | null;
  longitude: number | null;
  /** Raio de verificação do check-in, em metros. Fora dele gera alerta ao gestor; nunca bloqueia o técnico. */
  raioMetros: number;
}

export interface Setor {
  id: string;
  unidadeId: string;
  nome: string;
}

/** Tema trabalhado na visita. Nome, sistema e módulo pertencem ao mesmo registro (sem hierarquia). */
export interface Tema {
  id: string;
  nome: string;
  sistema: string;
  modulo: string;
  ativo: boolean;
}

/** Ocupação da Classificação Brasileira de Ocupações. */
export interface Cbo {
  /** 6 dígitos, sem hífen. */
  codigo: string;
  titulo: string;
}

export interface Participante {
  id: string;
  clienteId: string;
  nome: string;
  cbo: Cbo;
  setor: string;
  /** Somente dígitos; preenchido só quando o cliente exige CPF. */
  cpf: string | null;
  /** Cadastrado pelo técnico durante uma visita. */
  criadoEmCampo: boolean;
}

export type TipoVisita = "treinamento" | "implantacao" | "suporte_presencial" | "reuniao" | "visita_tecnica" | "treinamento_online";

export type StatusVisita = "em_andamento" | "encerrada" | "cancelada";

/** Aparelho em que o técnico fez o check-in. */
export type MeioRegistro = "celular" | "computador";

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

export interface Foto {
  id: string;
  url: string;
}

/** Participante registrado na visita (cópia dos dados no momento da presença). */
export interface PresencaVisita {
  participanteId: string;
  nome: string;
  cbo: Cbo;
  setor: string;
  cpf: string | null;
  confirmacao: "nominal" | "assinatura";
  /** Imagem da assinatura (data URL ou endereço no storage). */
  assinatura: string | null;
}

/** Uma mudança de campo dentro de uma alteração. */
export interface MudancaCampo {
  campo: string;
  antes: string;
  depois: string;
}

/** Registro de alteração da visita: quem, quando, o que mudou e por quê. */
export interface AlteracaoVisita {
  id: string;
  autorId: string;
  autorNome: string;
  em: string;
  acao: "encerramento" | "cancelamento" | "correcao";
  motivo: string;
  mudancas: MudancaCampo[];
}

export interface Visita {
  id: string;
  tecnicoId: string;
  clienteId: string;
  unidadeId: string;
  /** Setor da lista da unidade, ou null quando o técnico escolheu "outro". */
  setorId: string | null;
  setorOutro: string | null;
  tipo: TipoVisita;
  status: StatusVisita;
  /** Data e hora do servidor (ISO, UTC). */
  entrada: string;
  saida: string | null;
  checkin: Coordenadas | null;
  checkout: Coordenadas | null;
  /** Aparelho do check-in; aparece no relatório. */
  meio: MeioRegistro;
  /** Distância medida entre o check-in e a unidade, em metros. Null sem localização ou sem coordenadas da unidade. */
  distanciaCheckinM: number | null;
  /** Raio da unidade no momento do check-in (guardado para o alerta não mudar se o raio for alterado depois). */
  raioCheckinM: number | null;
  fotoAmbiente: Foto | null;
  /** Treinamento online. */
  printTela: Foto | null;
  linkReuniao: string | null;
  temaIds: string[];
  temaAdicional: string;
  fotosExtras: Foto[];
  presencas: PresencaVisita[];
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
  encerradaPorGestor: boolean;
  /** Relatório em que a visita foi incluída. */
  relatorioId: string | null;
  historico: AlteracaoVisita[];
}

export type StatusRelatorio = "rascunho" | "enviado" | "ajuste_solicitado" | "aprovado";

/** Decisão do aprovador do cliente sobre uma versão. */
export interface DecisaoRelatorio {
  tipo: "aprovado" | "ajuste";
  aprovadorNome: string;
  aprovadorEmail: string;
  motivo: string | null;
  em: string;
}

/** Uma emissão do relatório (v1, v2, …), congelada no momento do envio. */
export interface VersaoRelatorio {
  numero: number;
  emitidoEm: string;
  visitaIds: string[];
  pdfUrl: string | null;
  pdfTamanho: number;
  enviadoPara: { nome: string; email: string }[];
  /** Conteúdo congelado na emissão: o PDF e a página do aprovador mostram exatamente isto. */
  conteudo: ConteudoCongelado | null;
  decisao: DecisaoRelatorio | null;
}

/** Visita com os nomes resolvidos (cliente, técnico, unidade, setor, temas). */
export interface VisitaDetalhada extends Visita {
  tecnicoNome: string;
  clienteNome: string;
  unidadeNome: string;
  setorNome: string;
  temas: Tema[];
  /** Incluída em relatório aprovado: ninguém altera. */
  travada: boolean;
}

export interface ConteudoCongelado {
  cliente: { nome: string; cnpj: string; contrato: string };
  de: string;
  ate: string;
  visitas: VisitaDetalhada[];
  /** Ids das visitas de períodos anteriores. */
  deOutroPeriodo: string[];
  minutosPresenciais: number;
  minutosOnline: number;
}

/** Link de aprovação: um por aprovador e por versão; vale até a primeira decisão ou uma nova versão. */
export interface TokenAprovacao {
  token: string;
  relatorioId: string;
  versao: number;
  aprovadorNome: string;
  aprovadorCargo: string;
  aprovadorEmail: string;
  criadoEm: string;
  invalidadoEm: string | null;
}

export interface Relatorio {
  id: string;
  clienteId: string;
  /** Período (AAAA-MM-DD, horário de Brasília), inclusive. */
  de: string;
  ate: string;
  status: StatusRelatorio;
  /** Visitas do rascunho atual (ou da última versão emitida). */
  visitaIds: string[];
  versoes: VersaoRelatorio[];
  criadoEm: string;
  atualizadoEm: string;
}
