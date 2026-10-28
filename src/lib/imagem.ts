/** Compressão de imagem no navegador antes do envio (economiza dados móveis do técnico). */

const ALVO_BYTES = 500 * 1024;
const LADO_MAXIMO = 1600;

function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

const paraBlob = (canvas: HTMLCanvasElement, qualidade: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir."))), "image/jpeg", qualidade));

/** Faixa escura no rodapé com as linhas em branco (tamanho proporcional à largura da foto). */
function desenharCarimbo(ctx: CanvasRenderingContext2D, largura: number, altura: number, linhas: string[]) {
  const fonte = Math.max(14, Math.round(largura / 38));
  const respiro = Math.round(fonte * 0.6);
  const alturaFaixa = linhas.length * fonte * 1.3 + respiro * 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, altura - alturaFaixa, largura, alturaFaixa);
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fonte}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = "top";
  linhas.forEach((l, i) => ctx.fillText(l, respiro, altura - alturaFaixa + respiro + i * fonte * 1.3, largura - respiro * 2));
}

/**
 * Redimensiona (lado maior ≤ 1600 px) e reduz a qualidade do JPEG até ficar em ~500 KB.
 * Devolve um File JPEG pronto para o FormData. Recodificar pelo canvas também descarta o EXIF (inclusive GPS).
 * `carimbo`: linhas opcionais escritas no rodapé (ex.: data/hora e CEP).
 */
export async function comprimirImagem(arquivo: File, carimbo?: string[]): Promise<File> {
  const img = await carregar(arquivo);
  let escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (carimbo?.length) desenharCarimbo(ctx, canvas.width, canvas.height, carimbo);
    for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
      const blob = await paraBlob(canvas, q);
      if (blob.size <= ALVO_BYTES) return new File([blob], "foto.jpg", { type: "image/jpeg" });
    }
    escala *= 0.8; // ainda grande: reduz as dimensões e tenta de novo
  }
  const blob = await paraBlob(canvas, 0.45);
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}
