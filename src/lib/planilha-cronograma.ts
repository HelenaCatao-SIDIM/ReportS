import "server-only";
import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import { COLUNAS, lerLinhas, type LeituraPlanilha } from "@/lib/importar-cronograma";
import { TIPOS_VISITA } from "@/lib/visitas";

/** Planilha de plano pequena: 2 MB sobram para as 500 linhas permitidas. */
export const LIMITE_ARQUIVO_BYTES = 2 * 1024 * 1024;

/** Lê a primeira aba de um .xlsx e devolve as linhas do cronograma, ou o motivo de não ter conseguido. */
export async function lerPlanilha(arquivo: Buffer): Promise<LeituraPlanilha> {
  if (arquivo.length === 0) return { linhas: [], avisos: [], erro: "O arquivo está vazio." };
  if (arquivo.length > LIMITE_ARQUIVO_BYTES) return { linhas: [], avisos: [], erro: "O arquivo tem mais de 2 MB. Divida a planilha em arquivos menores." };
  // .xlsx é um arquivo zip: começa com "PK".
  if (arquivo[0] !== 0x50 || arquivo[1] !== 0x4b) return { linhas: [], avisos: [], erro: "O arquivo não é uma planilha do Excel (.xlsx). Se for .xls ou .csv, abra no Excel e salve como .xlsx." };
  try {
    return lerLinhas((await readSheet(arquivo)) as unknown[][]);
  } catch {
    return { linhas: [], avisos: [], erro: "Não consegui ler o arquivo. Confira se é uma planilha .xlsx sem senha e sem estar corrompida." };
  }
}

const negrito = (value: string) => ({ value, fontWeight: "bold" as const });

/** Modelo para baixar: uma aba com o cabeçalho e dois exemplos, e uma aba com as instruções. */
export async function modeloPlanilha(): Promise<Buffer> {
  const cabecalho = COLUNAS.map((c) => negrito(c.rotulo));
  const exemplo1 = COLUNAS.map((c) => c.exemplo);
  const exemplo2 = ["Prefeitura de Vale Verde", "SERP", "Posto Central", "", "Implantação", "20/11/2026", "", "Sem equipe: vale para todas as equipes"];
  const instrucoes: (string | ReturnType<typeof negrito>)[][] = [
    [negrito("Como preencher")],
    ["Uma linha por item do cronograma. A primeira aba é a que será lida; esta aba é só de ajuda."],
    [""],
    [negrito("Colunas")],
    ...COLUNAS.map((c) => [`${c.rotulo}${c.obrigatoria ? " (obrigatória)" : " (opcional)"}`]),
    [""],
    ["Cliente e Sistema: iguais ao cadastro (sem diferenciar acento nem maiúsculas). Cada linha precisa de um contrato ativo do cliente para o sistema."],
    ["Estabelecimento: o que não existir no cadastro será perguntado na tela: você escolhe cadastrar ou trocar por um existente."],
    ["Equipe: nomes do cadastro de Equipes, separados por vírgula (ex.: Equipe médica, Equipe de enfermagem). Em branco, vale para todas as equipes."],
    [`Atividade: ${TIPOS_VISITA.map((t) => t.label).join(", ")}.`],
    ["Prazo: uma data (por exemplo, 20/11/2026). Vale até o fim desse dia."],
    ["Horário: texto livre e opcional (ex.: 09:30 e 14h, Dia todo). Só para informação: não muda o cumprimento."],
    ["Observação: só a Administração vê; não vai para o relatório do cliente."],
    ["Colunas que não estão na lista (como “Setor”) são ignoradas."],
  ];
  return writeExcelFile([
    { data: [cabecalho, exemplo1, exemplo2], sheet: "Cronograma", columns: [{ width: 28 }, { width: 12 }, { width: 24 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 16 }, { width: 44 }] },
    { data: instrucoes, sheet: "Como preencher", columns: [{ width: 120 }] },
  ]).toBuffer();
}
