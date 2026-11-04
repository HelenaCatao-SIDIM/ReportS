import { cpfValido, normalizar } from "@/lib/format";
import { nomesParecidos } from "@/lib/similaridade";
import type { EstabelecimentoSaude, FuncionarioSaude } from "@/lib/saude-api";

/*
 * Regras da importação do SIDIM Saúde, sem banco (o repositório grava o que estas funções decidem).
 * - Estabelecimento: ligado pelo id do ERP. Sem ligação, um estabelecimento do cliente com o mesmo nome (sem acento)
 *   passa a ser o do ERP, em vez de nascer um repetido. Nada é apagado e o nome e o endereço editados no ReportS ficam;
 *   o endereço do ERP só entra quando o do ReportS está vazio.
 * - Profissional: entra como participante confirmado, ligado pelo id do USUÁRIO do ERP (o mesmo que o SINC grava ao
 *   capturar pelo painel). Funcionário sem usuário ou com usuário inativo fica de fora. Do confirmado que já existe, a
 *   importação só preenche CPF e CBO vazios: nunca troca o que alguém já preencheu.
 */

export interface EstabelecimentoExistente {
  id: string;
  nome: string;
  endereco: string;
  idErp: string | null;
}

export type PlanoEstabelecimento =
  | { acao: "criar"; idErp: string; nome: string; endereco: string }
  | { acao: "ligar"; id: string; idErp: string; endereco?: string }
  | { acao: "atualizar"; id: string; endereco: string }
  | { acao: "manter"; id: string };

/** Estabelecimentos dos funcionários, sem repetir (o mesmo estabelecimento aparece em vários funcionários). */
export function estabelecimentosDosFuncionarios(funcionarios: FuncionarioSaude[]): EstabelecimentoSaude[] {
  const porId = new Map<string, EstabelecimentoSaude>();
  for (const f of funcionarios) for (const e of f.estabelecimentos) if (!porId.has(e.idErp)) porId.set(e.idErp, e);
  return [...porId.values()];
}

export function planejarEstabelecimentos(existentes: EstabelecimentoExistente[], vindos: EstabelecimentoSaude[]): PlanoEstabelecimento[] {
  const porIdErp = new Map(existentes.filter((e) => e.idErp).map((e) => [e.idErp!, e]));
  // Só os ainda sem ligação podem ser casados pelo nome, e cada um uma vez só.
  const livres = existentes.filter((e) => !e.idErp);
  return vindos.map((v): PlanoEstabelecimento => {
    const enderecoNovo = (atual: string) => (!atual.trim() && v.endereco ? v.endereco : undefined);
    const ligado = porIdErp.get(v.idErp);
    if (ligado) {
      const endereco = enderecoNovo(ligado.endereco);
      return endereco ? { acao: "atualizar", id: ligado.id, endereco } : { acao: "manter", id: ligado.id };
    }
    const i = livres.findIndex((e) => normalizar(e.nome) === normalizar(v.nome));
    if (i >= 0) {
      const [mesmo] = livres.splice(i, 1);
      return { acao: "ligar", id: mesmo.id, idErp: v.idErp, endereco: enderecoNovo(mesmo.endereco) };
    }
    return { acao: "criar", idErp: v.idErp, nome: v.nome, endereco: v.endereco };
  });
}

export interface ParticipanteExistente {
  id: string;
  idErp: string | null;
  estado: string;
  nome: string;
  cpf: string | null;
  cboCodigo: string | null;
}

export interface CboConhecido {
  codigo: string;
  titulo: string;
}

export type PlanoParticipante =
  | { acao: "criar"; idUsuario: string; nome: string; cpf: string | null; cbo: CboConhecido | null; cpfEmUso: boolean; parecidoCom: string | null }
  | { acao: "atualizar"; id: string; cpf?: string; cbo?: CboConhecido }
  | { acao: "manter"; id: string }
  | { acao: "ignorar"; motivo: "sem_usuario" | "usuario_inativo" | "unido" | "repetido" };

/**
 * @param cbos ocupações da tabela oficial, pelo código. O primeiro CBO do funcionário que estiver na tabela é o usado.
 */
export function planejarParticipantes(
  existentes: ParticipanteExistente[],
  funcionarios: FuncionarioSaude[],
  cbos: Map<string, CboConhecido>,
): PlanoParticipante[] {
  const porIdErp = new Map(existentes.filter((p) => p.idErp).map((p) => [p.idErp!, p]));
  // O CPF é único por sistema do cliente entre os não unidos; os que esta importação grava entram na conta.
  const cpfsEmUso = new Set(existentes.filter((p) => p.cpf && p.estado !== "unido").map((p) => p.cpf!));
  const provisorios = existentes.filter((p) => p.estado === "provisorio");
  const vistos = new Set<string>();

  return funcionarios.map((f): PlanoParticipante => {
    if (!f.idUsuario) return { acao: "ignorar", motivo: "sem_usuario" };
    if (!f.usuarioAtivo) return { acao: "ignorar", motivo: "usuario_inativo" };
    // Dois funcionários com o mesmo usuário: vale o primeiro.
    if (vistos.has(f.idUsuario)) return { acao: "ignorar", motivo: "repetido" };
    vistos.add(f.idUsuario);

    const cpf = f.cpf && cpfValido(f.cpf) ? f.cpf : null;
    const cbo = f.cbos.map((c) => cbos.get(c)).find((c): c is CboConhecido => !!c) ?? null;
    const atual = porIdErp.get(f.idUsuario);

    if (atual) {
      if (atual.estado === "unido") return { acao: "ignorar", motivo: "unido" };
      const novoCpf = !atual.cpf && cpf && !cpfsEmUso.has(cpf) ? cpf : undefined;
      const novoCbo = !atual.cboCodigo && cbo ? cbo : undefined;
      if (novoCpf) cpfsEmUso.add(novoCpf);
      return novoCpf || novoCbo ? { acao: "atualizar", id: atual.id, cpf: novoCpf, cbo: novoCbo } : { acao: "manter", id: atual.id };
    }

    const cpfEmUso = !!cpf && cpfsEmUso.has(cpf);
    if (cpf && !cpfEmUso) cpfsEmUso.add(cpf);
    const parecido = provisorios.find((p) => nomesParecidos(p.nome, f.nome));
    return {
      acao: "criar",
      idUsuario: f.idUsuario,
      nome: f.nome,
      cpf: cpfEmUso ? null : cpf,
      cbo,
      cpfEmUso,
      parecidoCom: parecido?.nome ?? null,
    };
  });
}

export interface ResumoImportacao {
  funcionarios: number;
  estabelecimentos: { criados: number; ligados: number; atualizados: number; semMudanca: number };
  participantes: { criados: number; atualizados: number; semMudanca: number; semUsuario: number; usuarioInativo: number };
  /** Nomes dos profissionais que entraram sem CPF porque o CPF já é de outro participante. */
  cpfEmUso: string[];
  /** "Nome importado ≈ provisório": possíveis duplicados, para a lista de revisão. */
  parecidos: string[];
  /** Os profissionais não foram gravados (ex.: o banco ainda não libera a gravação ao ReportS). */
  avisoParticipantes: string | null;
}

export function contarEstabelecimentos(plano: PlanoEstabelecimento[]): ResumoImportacao["estabelecimentos"] {
  const n = (acao: PlanoEstabelecimento["acao"]) => plano.filter((p) => p.acao === acao).length;
  return { criados: n("criar"), ligados: n("ligar"), atualizados: n("atualizar"), semMudanca: n("manter") };
}

export function contarParticipantes(plano: PlanoParticipante[]): Omit<ResumoImportacao, "funcionarios" | "estabelecimentos" | "avisoParticipantes"> {
  const n = (acao: PlanoParticipante["acao"]) => plano.filter((p) => p.acao === acao).length;
  const ignorados = (motivo: string) => plano.filter((p) => p.acao === "ignorar" && p.motivo === motivo).length;
  const criados = plano.filter((p): p is Extract<PlanoParticipante, { acao: "criar" }> => p.acao === "criar");
  return {
    participantes: { criados: criados.length, atualizados: n("atualizar"), semMudanca: n("manter"), semUsuario: ignorados("sem_usuario"), usuarioInativo: ignorados("usuario_inativo") },
    cpfEmUso: criados.filter((p) => p.cpfEmUso).map((p) => p.nome),
    parecidos: criados.filter((p) => p.parecidoCom).map((p) => `${p.nome} ≈ ${p.parecidoCom}`),
  };
}
