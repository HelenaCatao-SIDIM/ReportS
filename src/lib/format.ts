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

/** 19999990000 → (19) 99999-0000; fixo de 10 dígitos → (19) 3333-0000. Aceita parcial, para máscara de digitação. */
export function formatarTelefone(valor: string) {
  const d = soDigitos(valor).slice(0, 11);
  if (!d) return "";
  if (d.length < 3) return `(${d}`;
  const resto = d.slice(2);
  const corte = d.length > 10 ? 5 : 4;
  return resto.length > corte ? `(${d.slice(0, 2)}) ${resto.slice(0, corte)}-${resto.slice(corte)}` : `(${d.slice(0, 2)}) ${resto}`;
}

/** Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular, que começa com 9 depois do DDD). */
export function telefoneValido(valor: string) {
  const d = soDigitos(valor);
  if (!/^[1-9][1-9]/.test(d)) return false;
  return d.length === 10 || (d.length === 11 && d[2] === "9");
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
