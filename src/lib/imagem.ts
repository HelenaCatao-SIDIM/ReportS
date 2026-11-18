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

/** Largura e altura lidas só do cabeçalho (sem decodificar os pixels), para pedir a imagem já reduzida. Null quando não dá. */
export async function dimensoesPeloCabecalho(arquivo: Blob): Promise<{ largura: number; altura: number } | null> {
  try {
    // 256 KB cobrem o cabeçalho mesmo com EXIF e miniatura embutida antes do SOF do JPEG.
    const b = new Uint8Array(await arquivo.slice(0, 256 * 1024).arrayBuffer());
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    // PNG: assinatura + IHDR com largura e altura em 16 e 20.
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { largura: dv.getUint32(16), altura: dv.getUint32(20) };
    }
    // JPEG: percorre os segmentos até o primeiro SOF (onde ficam as dimensões).
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        let marcador = b[i + 1];
        while (marcador === 0xff && i + 2 < b.length) marcador = b[++i + 1];
        i += 2;
        // Marcadores sem tamanho (início/fim e reinícios): seguem adiante.
        if (marcador === 0xd8 || marcador === 0xd9 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) continue;
        if (i + 2 > b.length) break;
        const tamanho = dv.getUint16(i);
        const ehSof =
          (marcador >= 0xc0 && marcador <= 0xc3) || (marcador >= 0xc5 && marcador <= 0xc7) || (marcador >= 0xc9 && marcador <= 0xcb) || (marcador >= 0xcd && marcador <= 0xcf);
        if (ehSof) {
          if (i + 7 > b.length) break;
          const altura = dv.getUint16(i + 3);
          const largura = dv.getUint16(i + 5);
          return largura && altura ? { largura, altura } : null;
        }
        i += tamanho;
      }
    }
  } catch {
    // formato desconhecido ou leitura falhou: decodifica em tamanho cheio (fallback)
  }
  return null;
}

/**
 * Decodifica a imagem já no menor tamanho possível e devolve algo que o canvas desenha. Com `createImageBitmap` e as
 * dimensões do cabeçalho, o navegador reduz a foto **durante a decodificação** (sem carregar a resolução cheia na memória —
 * é o que evita o estouro de memória com fotos grandes). `imageOrientation: "from-image"` mantém a rotação da câmera.
 * Sem suporte ou em caso de falha, cai no `<img>` tradicional. Quem chama fecha o bitmap (`close`) ao terminar.
 */
async function decodificar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      const dim = await dimensoesPeloCabecalho(arquivo);
      const maior = dim ? Math.max(dim.largura, dim.altura) : 0;
      if (dim && maior > LADO_MAXIMO) {
        const escala = LADO_MAXIMO / maior;
        return await createImageBitmap(arquivo, {
          imageOrientation: "from-image",
          resizeQuality: "high",
          resizeWidth: Math.round(dim.largura * escala),
          resizeHeight: Math.round(dim.altura * escala),
        });
      }
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      // cai no fallback abaixo
    }
  }
  return carregar(arquivo);
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
  const fonte = await decodificar(arquivo);
  try {
    let escala = Math.min(1, LADO_MAXIMO / Math.max(fonte.width, fonte.height));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    for (let tentativa = 0; tentativa < 6; tentativa++) {
      canvas.width = Math.round(fonte.width * escala);
      canvas.height = Math.round(fonte.height * escala);
      ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
      if (carimbo?.length) desenharCarimbo(ctx, canvas.width, canvas.height, carimbo);
      for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const blob = await paraBlob(canvas, q);
        if (blob.size <= ALVO_BYTES) return new File([blob], "foto.jpg", { type: "image/jpeg" });
      }
      escala *= 0.8; // ainda grande: reduz as dimensões e tenta de novo
    }
    const blob = await paraBlob(canvas, 0.45);
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } finally {
    // Libera o bitmap grande na hora (não espera o coletor de lixo): é o que segura a memória entre fotos seguidas.
    if (typeof ImageBitmap !== "undefined" && fonte instanceof ImageBitmap) fonte.close();
  }
}
