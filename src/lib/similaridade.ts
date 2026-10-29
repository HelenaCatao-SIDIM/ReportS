/**
 * Semelhança de nomes, igual à do SINC (ClickUpClientMatcher): sem acento, maiúsculas e só letras e números;
 * nomes iguais valem 1; os demais valem 1 − distância de Levenshtein ÷ tamanho do maior, e só "parecido" a partir de 0,75.
 */

export const LIMITE_NOME_PARECIDO = 0.75;

export function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual.push(Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo));
    }
    anterior = atual;
  }
  return anterior[b.length];
}

export function similaridade(a: string, b: string): number {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export const nomesParecidos = (a: string, b: string) => similaridade(a, b) >= LIMITE_NOME_PARECIDO;
