/**
 * Catálogo de permissões do ReportS (RN-PL-60). Na plataforma, cada serviço registra as próprias
 * permissões a cada publicação; os papéis e a atribuição aos usuários são feitos no Admin do SINC.
 */

export const PERMISSOES = {
  tecnico: "reports.tecnico",
  clientesCadastrar: "reports.clientes.cadastrar",
  contratosGerenciar: "reports.contratos.gerenciar",
  temasGerenciar: "reports.temas.gerenciar",
  participantesGerenciar: "reports.participantes.gerenciar",
  participantesRevisar: "reports.participantes.revisar",
  visitasGerenciar: "reports.visitas.gerenciar",
  relatoriosGerenciar: "reports.relatorios.gerenciar",
} as const;

export type CodigoPermissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

export interface PermissaoDoCatalogo {
  codigo: CodigoPermissao;
  grupo: string;
  descricao: string;
}

export const CATALOGO: PermissaoDoCatalogo[] = [
  { codigo: PERMISSOES.tecnico, grupo: "App do Técnico", descricao: "App do Técnico: check-in, visita, presenças, check-out e o próprio histórico." },
  { codigo: PERMISSOES.clientesCadastrar, grupo: "Administração", descricao: "Criar cliente à mão; editar nome, CNPJ e nomes no SINC; estabelecimentos e setores." },
  { codigo: PERMISSOES.contratosGerenciar, grupo: "Administração", descricao: "Contratos, tipo de comprovação, exigência de CPF e aprovadores." },
  { codigo: PERMISSOES.temasGerenciar, grupo: "Administração", descricao: "Temas das visitas." },
  { codigo: PERMISSOES.participantesGerenciar, grupo: "Administração", descricao: "Ver e editar participantes (CPF, CBO, setor) e criar provisórios fora de uma visita." },
  { codigo: PERMISSOES.participantesRevisar, grupo: "Administração", descricao: "Lista de revisão: juntar e desfazer junções de participantes." },
  { codigo: PERMISSOES.visitasGerenciar, grupo: "Administração", descricao: "Ver todas as visitas; corrigir, encerrar e cancelar." },
  { codigo: PERMISSOES.relatoriosGerenciar, grupo: "Administração", descricao: "Criar rascunho, emitir, reenviar e acompanhar relatórios." },
];

/** Qualquer permissão do ReportS além da do técnico dá acesso à Administração (que mostra só as telas permitidas). */
export const acessoAdministracao = (permissoes: readonly string[]) =>
  permissoes.some((p) => p.startsWith("reports.") && p !== PERMISSOES.tecnico);

export const acessoTecnico = (permissoes: readonly string[]) => permissoes.includes(PERMISSOES.tecnico);

/** Permissões que dão acesso a cada tela da Administração (qualquer uma basta). Sem entrada = qualquer um da Administração. */
export const PERMISSOES_DA_TELA: Record<string, CodigoPermissao[]> = {
  "/admin/clientes": [PERMISSOES.clientesCadastrar, PERMISSOES.contratosGerenciar],
  "/admin/aprovadores": [PERMISSOES.contratosGerenciar],
  "/admin/temas": [PERMISSOES.temasGerenciar],
  "/admin/participantes": [PERMISSOES.participantesGerenciar],
  "/admin/visitas": [PERMISSOES.visitasGerenciar],
  "/admin/relatorios": [PERMISSOES.relatoriosGerenciar],
  "/admin/emails": [PERMISSOES.relatoriosGerenciar],
};

export const temAlguma = (permissoes: readonly string[], exigidas: readonly string[]) => exigidas.some((p) => permissoes.includes(p));

/** Para onde o login leva: uma área só, ou o seletor quando a pessoa tem as duas. Null = sem acesso ao ReportS. */
export function destinoAposLogin(permissoes: readonly string[]): "/admin" | "/tecnico" | "/inicio" | null {
  const admin = acessoAdministracao(permissoes);
  const tecnico = acessoTecnico(permissoes);
  if (admin && tecnico) return "/inicio";
  if (admin) return "/admin";
  if (tecnico) return "/tecnico";
  return null;
}
