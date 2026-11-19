/*
 * Gera 15 registros de auditoria de exemplo, variados (vários tipos e ações, em datas diferentes), para ver a tela
 * /admin/auditoria cheia em desenvolvimento. Usa um ou dois usuários reais do SINC de desenvolvimento como autores.
 * Só roda fora de produção. Pode rodar mais de uma vez (os registros vão se acumulando).
 *
 * Uso: npx tsx scripts/exemplos-auditoria.ts
 */
import { plataforma, reports, rodar } from "./lib/bancos";

type Mudanca = { campo: string; antes: string; depois: string };

/** Cada exemplo: há quantas horas aconteceu, o tipo, o nome do registro, a ação e os campos antes → depois. */
const EXEMPLOS: { hAtras: number; entidade: string; rotulo: string; acao: string; mudancas: Mudanca[] }[] = [
  { hAtras: 1, entidade: "cliente", rotulo: "Prefeitura de Pará de Minas", acao: "criar",
    mudancas: [{ campo: "Nome", antes: "—", depois: "Prefeitura de Pará de Minas" }, { campo: "CNPJ", antes: "—", depois: "18307510000178" }, { campo: "Sistemas (qtde)", antes: "—", depois: "2" }] },
  { hAtras: 3, entidade: "cliente", rotulo: "Prefeitura Municipal de Igarapé", acao: "editar",
    mudancas: [{ campo: "Nome", antes: "Prefeitura de Igarapé", depois: "Prefeitura Municipal de Igarapé" }] },
  { hAtras: 6, entidade: "estabelecimento", rotulo: "UBS Central", acao: "criar",
    mudancas: [{ campo: "Nome", antes: "—", depois: "UBS Central" }, { campo: "Raio (m)", antes: "—", depois: "50" }] },
  { hAtras: 9, entidade: "estabelecimento", rotulo: "UBS Vila Nova", acao: "editar",
    mudancas: [{ campo: "Raio (m)", antes: "50", depois: "120" }, { campo: "Endereço", antes: "—", depois: "Rua das Flores, 100" }] },
  { hAtras: 26, entidade: "estabelecimento", rotulo: "Posto Antigo", acao: "excluir", mudancas: [] },
  { hAtras: 30, entidade: "contrato", rotulo: "Contrato (saude)", acao: "editar",
    mudancas: [{ campo: "Nível de comprovação", antes: "nominal", depois: "assinado" }, { campo: "Exige CPF", antes: "Não", depois: "Sim" }] },
  { hAtras: 50, entidade: "aprovador", rotulo: "Marta Souza", acao: "criar",
    mudancas: [{ campo: "Nome", antes: "—", depois: "Marta Souza" }, { campo: "Cargo", antes: "—", depois: "Secretária de Saúde" }, { campo: "E-mail", antes: "—", depois: "marta@cliente.exemplo" }] },
  { hAtras: 52, entidade: "aprovador", rotulo: "José Lima", acao: "inativar", mudancas: [] },
  { hAtras: 74, entidade: "tema", rotulo: "Prontuário Eletrônico", acao: "editar",
    mudancas: [{ campo: "Nome", antes: "Prontuario", depois: "Prontuário Eletrônico" }] },
  { hAtras: 78, entidade: "equipe", rotulo: "Equipe de enfermagem", acao: "criar",
    mudancas: [{ campo: "Nome", antes: "—", depois: "Equipe de enfermagem" }, { campo: "Temas mínimos (qtde)", antes: "—", depois: "3" }] },
  { hAtras: 96, entidade: "participante", rotulo: "Ana Pereira", acao: "editar",
    mudancas: [{ campo: "Ocupação (CBO)", antes: "—", depois: "Enfermeiro" }, { campo: "CPF", antes: "—", depois: "***.***.**8-00" }] },
  { hAtras: 100, entidade: "cronograma", rotulo: "UBS Central · treinamento · 2026-12-10", acao: "criar", mudancas: [] },
  { hAtras: 122, entidade: "relatorio", rotulo: "2026-10-01 a 2026-10-31", acao: "emitir",
    mudancas: [{ campo: "Versão", antes: "—", depois: "2" }] },
  { hAtras: 146, entidade: "visita", rotulo: "Prefeitura de Pará de Minas · Carlos Dias · 25/10/2026", acao: "corrigir",
    mudancas: [{ campo: "Motivo", antes: "—", depois: "Horário de saída errado" }, { campo: "Saída", antes: "25/10/2026 16:00", depois: "25/10/2026 17:30" }] },
];

rodar(async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Exemplos de auditoria não rodam em produção.");

  const usuarios = await plataforma.users.findMany({ where: { active: true }, select: { id: true, nome: true, email_address: true }, take: 2 });
  if (!usuarios.length) throw new Error("O banco plataforma de desenvolvimento não tem usuário ativo para ser autor.");
  const autor = (i: number) => usuarios[i % usuarios.length];

  const agora = Date.now();
  await reports.auditoria.createMany({
    data: EXEMPLOS.map((e, i) => {
      const u = autor(i);
      return {
        id: crypto.randomUUID(),
        em: new Date(agora - e.hAtras * 3_600_000),
        autorId: u.id,
        autorNome: u.nome ?? u.email_address,
        entidade: e.entidade,
        entidadeId: "",
        rotulo: e.rotulo,
        acao: e.acao,
        mudancas: e.mudancas,
      };
    }),
  });

  console.log(`${EXEMPLOS.length} registros de auditoria de exemplo inseridos. Veja em /admin/auditoria.`);
});
