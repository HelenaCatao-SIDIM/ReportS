/**
 * Dados da SIDIM que saem em todos os relatórios ao cliente: logo e dados no cabeçalho do PDF, e assinatura, no PDF e na página do
 * aprovador. Não acessa banco nem arquivos (serve ao servidor e ao navegador). Campo vazio não aparece no relatório.
 */
export interface DadosEmpresa {
  nome: string;
  razaoSocial?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  site?: string;
}

// Telefone e e-mail ficam de fora de propósito (decisão do Bruno em 05/11/2026): preenchê-los aqui os faz sair no cabeçalho do PDF e
// no rodapé da página do aprovador, sem mexer em mais nada.
export const EMPRESA: DadosEmpresa = {
  nome: "SIDIM Tecnologia",
  razaoSocial: "SIDIM Sistemas",
  cnpj: "10.852.690/0001-60",
  endereco: "Rua Treze de Maio, 79 - Centro, Sabará - MG, CEP 34.505-270",
  site: "www.sidimsistemas.com.br",
};

/** Quem assina os relatórios (imagem da assinatura em `public/sidim/`). */
export const ASSINANTE = { nome: "Eduardo Catão Ribeiro", empresa: "SIDIM Tecnologia" } as const;

/** Imagens em `public/sidim/` (tamanho em pixels, para manter a proporção). */
export const LOGO = { arquivo: "/sidim/logo.png", largura: 696, altura: 271 } as const;
export const ASSINATURA = { arquivo: "/sidim/assinatura-eduardo.png", largura: 1200, altura: 257 } as const;

/** Linhas do bloco de dados da empresa, só com o que está preenchido. A primeira é o nome. */
export function linhasDaEmpresa(e: DadosEmpresa = EMPRESA): string[] {
  const contato = [e.telefone, e.email].map((x) => x?.trim()).filter(Boolean).join(" · ");
  const razao = e.razaoSocial?.trim();
  return [e.nome.trim(), razao && razao !== e.nome.trim() ? razao : "", e.cnpj?.trim() ? `CNPJ ${e.cnpj.trim()}` : "", e.endereco?.trim() ?? "", contato, e.site?.trim() ?? ""].filter(Boolean);
}
