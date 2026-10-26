import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { enviarEmail } from "@/lib/email";
import { formatarDataCurta } from "@/lib/visitas";
import { RelatorioPdf, type ImagensPdf } from "@/lib/pdf/relatorio-pdf";
import { lerImagemPorUrl, salvarArquivo } from "@/lib/repo/arquivos";
import { congelar, montarConteudo, registrarEmissao } from "@/lib/repo/relatorios";
import type { ConteudoCongelado } from "@/lib/types";

/** Acima disto, o e-mail vai sem anexo (só com o botão "Ver relatório"); o download continua disponível. */
export const LIMITE_ANEXO = 8 * 1024 * 1024;

/** Escapa texto digitado (nomes) antes de entrar no HTML do e-mail. */
const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const urlBase = () => process.env.APP_URL ?? "http://localhost:3000";

function formato(b: Buffer): "png" | "jpg" | null {
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  return null; // outros formatos (ex.: webp) não entram no PDF
}

async function carregarImagens(c: ConteudoCongelado): Promise<ImagensPdf> {
  const urls = new Set<string>();
  for (const v of c.visitas) {
    for (const f of [v.fotoAmbiente, v.printTela, ...v.fotosExtras]) if (f) urls.add(f.url);
    for (const p of v.presencas) if (p.assinatura) urls.add(p.assinatura);
  }
  const mapa: ImagensPdf = new Map();
  await Promise.all(
    [...urls].map(async (url) => {
      const data = await lerImagemPorUrl(url);
      const fmt = data && formato(data);
      if (data && fmt) mapa.set(url, { data, format: fmt });
    }),
  );
  return mapa;
}

/** Gera o PDF da versão, registra a emissão e envia o e-mail a todos os aprovadores do cliente. */
export async function emitirRelatorio(id: string) {
  const c = await montarConteudo(id);
  if (!c) throw new Error("Relatório não encontrado");
  if (c.relatorio.status !== "rascunho" && c.relatorio.status !== "ajuste_solicitado") throw new Error("Este relatório não pode ser emitido agora");
  if (!c.visitas.length) return { erro: "O relatório não tem visitas." };
  if (!c.cliente.aprovadores.length) return { erro: "O cliente não tem aprovadores cadastrados." };

  const conteudo = congelar(c);
  const numero = c.relatorio.versoes.length + 1;
  const emitidoEm = new Date().toISOString();
  const pdf = await renderToBuffer(<RelatorioPdf conteudo={conteudo} versao={numero} emitidoEm={emitidoEm} imagens={await carregarImagens(conteudo)} />);
  const arquivo = await salvarArquivo(pdf, "application/pdf");

  const { versao, links } = await registrarEmissao(id, { conteudo, pdfUrl: arquivo.url, pdfTamanho: pdf.length, emitidoEm });

  const periodo = `${formatarDataCurta(conteudo.de)} a ${formatarDataCurta(conteudo.ate)}`;
  const anexa = pdf.length <= LIMITE_ANEXO;
  for (const l of links) {
    await enviarEmail({
      para: { nome: l.aprovadorNome, email: l.aprovadorEmail },
      assunto: `Relatório de atendimento SIDIM — ${conteudo.cliente.nome} — ${periodo}${versao.numero > 1 ? ` (v${versao.numero})` : ""}`,
      html: [
        `<p>Olá, ${esc(l.aprovadorNome)}.</p>`,
        `<p>Segue o relatório de atendimento da SIDIM referente ao período de <b>${periodo}</b>${versao.numero > 1 ? `, versão <b>v${versao.numero}</b> (com os ajustes solicitados)` : ""}.</p>`,
        `<p>${conteudo.visitas.length === 1 ? "1 visita registrada" : `${conteudo.visitas.length} visitas registradas`}. ${anexa ? "O PDF segue em anexo." : "O PDF ficou grande para anexar; baixe-o pela página do relatório."}</p>`,
        `<p>Use o botão abaixo para ver o relatório completo e <b>aprovar</b> ou <b>pedir ajuste</b>. Basta a decisão de um dos aprovadores.</p>`,
      ].join(""),
      anexos: anexa ? [{ nome: `relatorio-${conteudo.de.slice(0, 7)}-v${versao.numero}.pdf`, url: arquivo.url, tamanho: pdf.length }] : [],
      botao: { texto: "Ver relatório", url: `${urlBase()}/aprovacao/${l.token}` },
      relatorioId: id,
    });
  }
  return { versao: versao.numero, destinatarios: links.length, tamanho: pdf.length, anexado: anexa };
}
