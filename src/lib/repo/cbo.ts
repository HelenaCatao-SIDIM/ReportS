import "server-only";
import { normalizar } from "@/lib/format";
import type { Cbo } from "@/lib/types";

/*
 * Tabela CBO — AMOSTRA PROVISÓRIA para o mockup.
 * Os códigos abaixo NÃO foram conferidos com a tabela oficial do Ministério do Trabalho (CBO 2002).
 * Na fase de banco, esta lista é substituída pela importação da tabela oficial completa (~2.600 ocupações);
 * a função de busca continua com a mesma assinatura.
 */
const AMOSTRA: Cbo[] = [
  { codigo: "411005", titulo: "Auxiliar de escritório" },
  { codigo: "411010", titulo: "Assistente administrativo" },
  { codigo: "410105", titulo: "Supervisor administrativo" },
  { codigo: "142105", titulo: "Gerente administrativo" },
  { codigo: "422105", titulo: "Recepcionista, em geral" },
  { codigo: "252305", titulo: "Secretária(o) executiva(o)" },
  { codigo: "351505", titulo: "Técnico em secretariado" },
  { codigo: "252210", titulo: "Contador" },
  { codigo: "252405", titulo: "Analista de recursos humanos" },
  { codigo: "212405", titulo: "Analista de desenvolvimento de sistemas" },
  { codigo: "317210", titulo: "Técnico de apoio ao usuário de informática (helpdesk)" },
  { codigo: "414105", titulo: "Almoxarife" },
  { codigo: "421125", titulo: "Operador de caixa" },
  { codigo: "514320", titulo: "Faxineiro" },
  { codigo: "223505", titulo: "Enfermeiro" },
  { codigo: "322205", titulo: "Técnico de enfermagem" },
  { codigo: "322230", titulo: "Auxiliar de enfermagem" },
  { codigo: "225125", titulo: "Médico clínico" },
  { codigo: "223405", titulo: "Farmacêutico" },
  { codigo: "223605", titulo: "Fisioterapeuta geral" },
  { codigo: "223710", titulo: "Nutricionista" },
  { codigo: "223208", titulo: "Cirurgião dentista - clínico geral" },
  { codigo: "251510", titulo: "Psicólogo clínico" },
  { codigo: "251605", titulo: "Assistente social" },
  { codigo: "515105", titulo: "Agente comunitário de saúde" },
];

/** Busca ocupações pelo título (sem acento) ou pelo código. Retorna no máximo `limite` itens. */
export async function pesquisarCbo(termo: string, limite = 20): Promise<Cbo[]> {
  const t = normalizar(termo);
  if (t.length < 2) return [];
  const digitos = termo.replace(/\D/g, "");
  const palavras = t.split(/\s+/);
  return AMOSTRA.filter((c) => {
    if (digitos.length >= 3 && c.codigo.startsWith(digitos)) return true;
    const titulo = normalizar(c.titulo);
    return palavras.every((p) => titulo.includes(p));
  })
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"))
    .slice(0, limite);
}

export async function buscarCbo(codigo: string): Promise<Cbo | null> {
  return AMOSTRA.find((c) => c.codigo === codigo) ?? null;
}
