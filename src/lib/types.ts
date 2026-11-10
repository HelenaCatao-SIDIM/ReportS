/**
 * Pessoa da SIDIM (cadastro único da plataforma, tabela `users`). O que ela pode fazer vem dos papéis e permissões.
 * O id é o da plataforma (número), em texto. A senha nunca sai do repositório de usuários.
 */
export interface UsuarioPublico {
  id: string;
  /** Usuário migrado do SINC sem nome: o e-mail. */
  nome: string;
  email: string;
  ativo: boolean;
  /** Só dígitos, com DDD (10 ou 11). Opcional; será o destino do aviso de visita aberta por WhatsApp. */
  telefone: string | null;
  /** Papéis atribuídos (ligação usuário-papel). */
  papelIds: string[];
}

/** Usuário da sessão com o que ele pode fazer, lido a cada requisição. */
export interface UsuarioLogado extends UsuarioPublico {
  /** Códigos das permissões somadas dos papéis. */
  permissoes: string[];
  papeis: string[];
}

export type NivelComprovacao = "nominal" | "assinado";

/**
 * Pessoa que aprova relatórios, em cadastro próprio (independente dos participantes).
 * Pode aprovar para mais de um contrato, até de clientes diferentes; não tem login.
 */
export interface Aprovador {
  id: string;
  nome: string;
  cargo: string;
  /** Único no cadastro (minúsculas). */
  email: string;
  ativo: boolean;
}

/** Um cadastro por cliente, identificado pelo CNPJ. Os sistemas que ele usa ficam em `SistemaDoCliente`. */
export interface Cliente {
  id: string;
  nome: string;
  /** Somente dígitos (14). Vazio = "CNPJ pendente" (cliente que veio do SINC); não impede emitir relatório (o PDF mostra "—"). */
  cnpj: string;
  ativo: boolean;
  /** De onde o cliente veio: criado à mão no ReportS (implantação) ou pelo SINC. */
  origem: "manual" | "sinc";
  /** Nome do cliente no SINC (o mesmo do campo "Cliente / Município" dos atendimentos), para cruzar os chamados de suporte. O identificador interno continua `nomesFortics`. */
  nomesFortics: string[];
  /** Com vínculo no ClickUp, o nome é o da opção e não se edita no ReportS (RN-PL-12). */
  nomeDoClickUp: boolean;
}

/**
 * Situação de cada sistema de um cliente: em implantação (criado à mão, ainda sem tenant), sem cliente
 * (o tenant apareceu no SINC e ainda não foi ligado; o ReportS não enxerga estes) ou vinculado.
 */
export type EstadoSistemaCliente = "em_implantacao" | "sem_cliente" | "vinculado";

/** Cada sistema que um cliente usa. Um cliente tem no máximo um registro por sistema. */
export interface SistemaDoCliente {
  id: string;
  clienteId: string;
  /** Código do sistema (ver `Sistema`). */
  sistema: string;
  /** Vazio enquanto em implantação. A ligação com o tenant é feita no SINC. */
  tenantId: string | null;
  estado: EstadoSistemaCliente;
}

/** Relatório de atendimentos do suporte: só o resumo (sintético) ou o resumo e a lista de todos os atendimentos (analítico). */
export type TipoRelatorioAtendimentos = "sintetico" | "analitico";

/** Contrato de um sistema do cliente: o que sai na capa do relatório, como comprovar a presença e quem aprova. */
export interface Contrato {
  id: string;
  sistemaDoClienteId: string;
  /** Texto usado na capa do relatório. */
  texto: string;
  nivel: NivelComprovacao;
  exigeCpf: boolean;
  /** Como os atendimentos do suporte saem no relatório deste contrato. */
  relatorioAtendimentos: TipoRelatorioAtendimentos;
  /** Contrato inativo não aparece para o técnico no check-in. */
  ativo: boolean;
  aprovadorIds: string[];
}

export interface Unidade {
  id: string;
  clienteId: string;
  nome: string;
  endereco: string;
  /** Digitadas à mão; com elas, o check-in presencial grava a distância até o estabelecimento. */
  latitude: number | null;
  longitude: number | null;
  /** Raio de verificação do check-in, em metros. Fora dele gera alerta para a administração; nunca bloqueia o técnico. */
  raioMetros: number;
  /** CNES, quando o estabelecimento veio do Saúde com ele; vazio nos cadastrados à mão. */
  cnes: string;
}

export interface Setor {
  id: string;
  unidadeId: string;
  nome: string;
}

/**
 * Sistema (ERP) da SIDIM. O cadastro é do SINC; o ReportS só lê.
 * O código é a chave gravada em todos os registros e nunca muda.
 */
export interface Sistema {
  codigo: string;
  nome: string;
  /** Nome da opção no campo "Sistemas" do ClickUp; vazio = o próprio código. */
  nomeClickUp: string | null;
  /** Como o sistema aparece no Fortics, para filtrar os chamados de suporte. */
  nomeFortics: string | null;
  ativo: boolean;
  ordem: number;
}

/** Tema trabalhado na visita. Nome, sistema e módulo pertencem ao mesmo registro (sem hierarquia). */
export interface Tema {
  id: string;
  nome: string;
  /** Código do sistema (ver `Sistema`). */
  sistema: string;
  /** Nome do sistema para mostrar; preenchido na leitura. */
  sistemaNome: string;
  modulo: string;
  ativo: boolean;
}

/**
 * Equipe do cliente (médica, enfermagem, administrativa…). Cadastro único da SIDIM, vale para todos os clientes.
 * Quando o técnico marca a equipe numa implantação ou num treinamento, o ReportS sugere os temas mínimos dela.
 */
export interface Equipe {
  id: string;
  nome: string;
  /** Temas mínimos, de qualquer sistema; na visita só aparecem os do sistema do contrato. */
  temaIds: string[];
  /** Ocupações (CBO) que se enquadram na equipe: só algumas, escolhidas da tabela. */
  cbos: Cbo[];
  ativo: boolean;
}

/** Ocupação da Classificação Brasileira de Ocupações. */
export interface Cbo {
  /** 6 dígitos, sem hífen. */
  codigo: string;
  titulo: string;
}

/**
 * Confirmado: veio do ERP (tem o id do usuário no ERP); o nome é do ERP e não se edita no ReportS.
 * Provisório: criado no ReportS, sem o id do ERP. (A junção de provisório com confirmado é uma fase futura.)
 */
export type EstadoParticipante = "confirmado" | "provisorio";

/** De onde veio o registro: captura do painel do SINC, técnico em campo ou cadastro na Administração do ReportS. */
export type OrigemParticipante = "painel_sinc" | "campo_reports" | "cadastro_reports";

/** Pessoa que participa dos treinamentos, identificada dentro de um sistema do cliente (o mesmo cliente tem listas diferentes por sistema). */
export interface Participante {
  id: string;
  sistemaDoClienteId: string;
  /** Id do usuário no ERP (o userId que o ERP manda ao SINC). Obrigatório no confirmado; vazio no provisório. */
  idErp: string | null;
  estado: EstadoParticipante;
  origem: OrigemParticipante;
  nome: string;
  /** Null no confirmado que ainda não teve a ocupação preenchida no ReportS. */
  cbo: Cbo | null;
  setor: string;
  /** Somente dígitos; preenchido só quando o contrato exige CPF. */
  cpf: string | null;
}

export type TipoVisita = "treinamento" | "implantacao" | "suporte_presencial" | "reuniao" | "visita_tecnica" | "treinamento_online";

export type StatusVisita = "em_andamento" | "encerrada" | "cancelada";

/** Como a visita foi registrada: pelo aparelho do técnico, ou lançada depois pela Administração ("retroativa", sem GPS nem assinatura). */
export type MeioRegistro = "celular" | "computador" | "retroativa";

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

/** Situação da conversão da coordenada em CEP. */
export type StatusEndereco = "pendente" | "ok" | "sem_cep" | "falhou";

/** Endereço obtido a partir da coordenada (geocodificação reversa). */
export interface EnderecoVisita {
  status: StatusEndereco;
  /** Somente dígitos (8). Exibido como 87020-000. */
  cep: string | null;
  /** true quando o CEP veio pela rua (ViaCEP) ou é o CEP geral da cidade. */
  aproximado: boolean;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  fonte: "nominatim" | "viacep" | null;
  /** ISO. */
  atualizadoEm: string;
}

/**
 * Local capturado no check-in/check-out. A coordenada é a prova original e nunca é exibida
 * quando a localização por CEP está ligada. Campos novos opcionais: as visitas antigas não têm.
 */
export interface LocalVisita extends Coordenadas {
  /** Precisão informada pelo GPS, em metros. */
  precisaoM?: number | null;
  /** Hora do celular no momento da captura (ISO). */
  capturadoEm?: string | null;
  /** Hora do servidor ao receber (ISO). */
  recebidoEm?: string | null;
  endereco?: EnderecoVisita | null;
}

export interface Foto {
  id: string;
  url: string;
  /** "lista_presenca": foto da lista de presença em papel (lançamento retroativo, no lugar ou além dos nomes marcados). */
  legenda?: "lista_presenca";
}

/** Participante registrado na visita (cópia dos dados no momento da presença). */
export interface PresencaVisita {
  participanteId: string;
  /** Situação do participante no dia da presença (selo "Confirmado" ou "Provisório"; o aprovador e o PDF só mostram o nome). */
  estado: EstadoParticipante;
  nome: string;
  cbo: Cbo | null;
  setor: string;
  cpf: string | null;
  confirmacao: "nominal" | "assinatura";
  /** Imagem da assinatura (data URL ou endereço no storage). */
  assinatura: string | null;
  /**
   * Como foi validada além da assinatura: o próprio participante entrou no Saúde (`login_saude`) ou o técnico registrou sem o
   * login (`sem_login`). Ausente ou nulo quando o login não era exigido e nas presenças antigas.
   */
  validacao?: "login_saude" | "sem_login" | null;
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
  acao: "encerramento" | "cancelamento" | "correcao" | "lancamento";
  motivo: string;
  mudancas: MudancaCampo[];
}

export interface Visita {
  id: string;
  tecnicoId: string;
  clienteId: string;
  /** Contrato escolhido no check-in: dele saem o sistema, a forma de comprovação, o CPF e os aprovadores. */
  contratoId: string;
  unidadeId: string;
  /** Setor da lista do estabelecimento, ou null quando o técnico escolheu "outro". */
  setorId: string | null;
  setorOutro: string | null;
  tipo: TipoVisita;
  status: StatusVisita;
  /** Data e hora do servidor (ISO, UTC). */
  entrada: string;
  saida: string | null;
  checkin: LocalVisita | null;
  checkout: LocalVisita | null;
  /** Aparelho do check-in; aparece no relatório. */
  meio: MeioRegistro;
  /** Distância medida entre o check-in e o estabelecimento, em metros. Null sem localização ou sem coordenadas do estabelecimento. */
  distanciaCheckinM: number | null;
  /** Raio do estabelecimento no momento do check-in (guardado para o alerta não mudar se o raio for alterado depois). */
  raioCheckinM: number | null;
  fotoAmbiente: Foto | null;
  /** Treinamento online. */
  printTela: Foto | null;
  linkReuniao: string | null;
  /** Equipes treinadas (implantação e treinamentos). */
  equipeIds: string[];
  temaIds: string[];
  temaAdicional: string;
  fotosExtras: Foto[];
  presencas: PresencaVisita[];
  observacoes: string;
  pendencias: string;
  proximosPassos: string;
  encerradaPelaAdministracao: boolean;
  /** Relatório em que a visita foi incluída. */
  relatorioId: string | null;
  historico: AlteracaoVisita[];
}

/** "emitido": a versão está pronta (PDF gerado), mas ainda não foi enviada por e-mail. */
export type StatusRelatorio = "rascunho" | "emitido" | "enviado" | "ajuste_solicitado" | "aprovado";

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

/** Setor acrescentado à visita depois do check-in (o técnico treinou mais gente do que previa). */
export interface SetorExtraVisita {
  id: string;
  /** Setor cadastrado do estabelecimento; null quando foi digitado ("outro"). */
  setorId: string | null;
  nome: string;
}

/** Visita com os nomes resolvidos (cliente, técnico, estabelecimento, setor, temas). */
export interface VisitaDetalhada extends Visita {
  tecnicoNome: string;
  clienteNome: string;
  /** Código e nome do sistema do contrato da visita. */
  sistema: string;
  sistemaNome: string;
  unidadeNome: string;
  /** Setor do check-in. */
  setorNome: string;
  /** Setores acrescentados depois. Opcional: as versões de relatório emitidas antes disso não têm. */
  setoresExtras?: SetorExtraVisita[];
  /** Nomes das equipes treinadas. Opcional: as versões de relatório emitidas antes das equipes não têm. */
  equipes?: string[];
  temas: Tema[];
  /** Incluída em relatório aprovado: ninguém altera. */
  travada: boolean;
}

export interface ContagemSuporte {
  nome: string;
  quantidade: number;
}

/** Chamado de suporte (Fortics) aberto e fechado no período. Sem transcrição nem avaliação do agente. */
export interface ChamadoSuporte {
  protocolo: string;
  abertura: string;
  encerramento: string;
  sistema: string;
  topico: string;
  motivoEncerramento: string;
  /** Técnico da SIDIM que atendeu. */
  agente: string;
  /** Nome de quem pediu o atendimento (o usuário do cliente). Opcional: versões antigas e fluxos antigos do n8n não têm. */
  solicitante?: string;
  /** Tempo dedicado ao atendimento (TMA), em minutos. O n8n manda como tempoAtendimentoMin (ou duracaoMin, no formato antigo). */
  duracaoMin?: number | null;
  /**
   * O ReportS marca quando o n8n não trouxe o tempo deste chamado: a lista mostra "—" e ele fica fora do atendimento médio e do tempo total.
   * Versões emitidas antes de 06/11/2026 não têm a marca e seguem com o tempo calculado pelo encerramento menos a abertura (o que já foi enviado não muda).
   */
  semTempo?: boolean;
}

/** Resumo dos chamados de suporte do cliente no período, vindo do n8n (congelado na emissão). */
export interface ResumoSuporte {
  /** "nao_configurado": a conexão com o n8n ainda não foi informada em Administração → Configurações. */
  situacao: "ok" | "sem_vinculo" | "indisponivel" | "nao_configurado";
  totalAbertosEFechados: number;
  porSistema: ContagemSuporte[];
  /**
   * Nome do sistema usado para filtrar os chamados (o "Nome no Fortics" do sistema do contrato). Null = sem filtro, todos os
   * sistemas do cliente (o sistema não tem o nome cadastrado). Opcional: versões emitidas antes do filtro não têm.
   */
  sistemaFiltro?: string | null;
  /** Nomes do cliente pelos quais os chamados foram buscados (o nome no SINC e os outros cadastrados). Opcional: versões antigas não têm. */
  nomesBuscados?: string[];
  porTopico: ContagemSuporte[];
  porMotivoEncerramento: ContagemSuporte[];
  tempoMedioEsperaMin: number | null;
  chamados: ChamadoSuporte[];
  /** Quando foi consultado (ISO). */
  consultadoEm: string;
}

export interface ConteudoCongelado {
  cliente: { nome: string; cnpj: string; contrato: string };
  sistema: { codigo: string; nome: string };
  de: string;
  ate: string;
  visitas: VisitaDetalhada[];
  /** Ids das visitas de períodos anteriores. */
  deOutroPeriodo: string[];
  minutosPresenciais: number;
  minutosOnline: number;
  /** Chamados de suporte no período. Opcional: versões emitidas antes desta funcionalidade não têm. */
  suporte?: ResumoSuporte | null;
  /** Tipo do relatório de atendimentos do contrato no momento da emissão. Opcional: versões antigas valem como sintético. */
  relatorioAtendimentos?: TipoRelatorioAtendimentos;
  /** Cronograma de implantação do contrato. Opcional: versões emitidas antes desta funcionalidade não têm. */
  cronograma?: CronogramaCongelado | null;
}

/**
 * Item do cronograma de implantação: um estabelecimento que deve receber uma atividade (treinamento, implantação…)
 * até um prazo, para as equipes do item. É sempre de um contrato (cliente + sistema).
 */
export interface ItemCronograma {
  id: string;
  clienteId: string;
  contratoId: string;
  unidadeId: string;
  /** Equipes que precisam ser treinadas; vazio = qualquer visita do tipo no estabelecimento cumpre. */
  equipeIds: string[];
  /** Tipo de visita que cumpre o item. */
  tipo: TipoVisita;
  /** Prazo (AAAA-MM-DD, horário de Brasília), inclusive. */
  prazo: string;
  /** Horário combinado, texto livre e opcional ("09:30 e 14h"). Só informativo: não conta para repetido nem cumprimento. */
  horario: string;
  observacao: string;
  cancelado: boolean;
}

/** Situação do item, calculada pelas visitas encerradas do contrato (nunca digitada). */
export type SituacaoCronograma = "cumprido" | "cumprido_com_atraso" | "no_prazo" | "a_vencer" | "atrasado" | "cancelado";

export interface ItemCronogramaComSituacao extends ItemCronograma {
  unidadeNome: string;
  /** Nomes das equipes do item, em ordem alfabética. */
  equipeNomes: string[];
  situacao: SituacaoCronograma;
  /** Data (AAAA-MM-DD) da primeira visita encerrada que cumpriu o item. */
  cumpridoEm: string | null;
  /** Dias de hoje até o prazo; negativo = prazo vencido. */
  diasParaPrazo: number;
}

/** Cronograma do contrato como o cliente o vê no relatório: congelado na emissão (sem observação interna). */
export interface CronogramaCongelado {
  /** Data (AAAA-MM-DD, horário de Brasília) em que a situação foi calculada. */
  em: string;
  itens: {
    unidadeNome: string;
    /** Equipes do item. Opcional: versões emitidas antes das equipes no cronograma não têm (e trazem o setor). */
    equipes?: string[];
    /** Legado: setor do item nas versões emitidas antes das equipes. */
    setorNome?: string | null;
    tipo: TipoVisita;
    prazo: string;
    situacao: SituacaoCronograma;
    cumpridoEm: string | null;
  }[];
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
  /** Um relatório é de um contrato (cliente + sistema); cliente com dois sistemas tem dois relatórios por período. */
  contratoId: string;
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
