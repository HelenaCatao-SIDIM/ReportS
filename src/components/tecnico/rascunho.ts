/**
 * Rascunhos guardados no aparelho do técnico (localStorage).
 * Nunca quebram a tela: sem armazenamento disponível (modo privado, por exemplo), simplesmente não guardam.
 */

export function lerRascunho<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function guardarRascunho(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
}

export function apagarRascunho(chave: string) {
  try {
    localStorage.removeItem(chave);
  } catch {}
}
