/** Utilitários de formatação e validação usados no servidor e no navegador. */

export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** 12345678000190 → 12.345.678/0001-90 (aceita parcial, para máscara de digitação). */
export function formatarCnpj(valor: string) {
  const d = soDigitos(valor).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Confere os dois dígitos verificadores do CNPJ. */
export function cnpjValido(valor: string) {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

export const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Remove acentos e caixa, para buscas. */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** 12345678909 → 123.456.789-09 (aceita parcial, para máscara de digitação). */
export function formatarCpf(valor: string) {
  return soDigitos(valor)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** CPF mascarado para relatório e página do aprovador: ***.456.789-** */
export function mascararCpf(valor: string) {
  const d = soDigitos(valor);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "";
}

/** Confere os dois dígitos verificadores do CPF. */
export function cpfValido(valor: string) {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(d.slice(0, 9));
  return d.endsWith(`${d1}${digito(d.slice(0, 9) + d1)}`);
}

/** Código CBO 411010 → 4110-10 */
export const formatarCbo = (codigo: string) => codigo.replace(/^(\d{4})(\d{2})$/, "$1-$2");

/** 87020000 → 87020-000 */
export const formatarCep = (cep: string) => soDigitos(cep).replace(/^(\d{5})(\d{3})$/, "$1-$2");

/** Precisão do GPS no estilo "aprox. 15 m": a localização nunca é apresentada como exata. */
export const textoPrecisao = (metros: number) => `aprox. ${Math.round(metros)} m`;

/** Partes do endereço em uma linha: "Rua X, Bairro, Cidade/UF" (só o que existir). */
export function textoEndereco(e: { logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null }) {
  const cidade = [e.cidade, e.uf].filter(Boolean).join("/");
  return [e.logradouro, e.bairro, cidade].filter(Boolean).join(", ");
}
