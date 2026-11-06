import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { enviarEmail } from "@/lib/email";
import { buscarResumoSuporte } from "@/lib/suporte";
import { buscarSistema } from "@/lib/repo/sistemas";
import { congelarCronograma } from "@/lib/repo/cronograma";
import { dataLocal } from "@/lib/datas";
import { formatarDataCurta } from "@/lib/visitas";
import { conteudoParaEmitir, podeAtualizarRelatorio, podeEnviarRelatorio } from "@/lib/regras-relatorio";
import { nomeDoArquivoPdf, nomeDoRelatorio } from "@/lib/nome-pdf";
import { RelatorioPdf, type ImagensPdf } from "@/lib/pdf/relatorio-pdf";
import { carregarMarcaPdf } from "@/lib/pdf/marca";
import { lerImagemPorUrl, salvarArquivo } from "@/lib/repo/arquivos";
import { buscarRelatorio, congelar, montarConteudo, registrarEmissao, registrarEnvio, type ConteudoRelatorio } from "@/lib/repo/relatorios";
import { preencherCepsPendentes } from "@/lib/cep-visitas";
import type { ConteudoCongelado, ResumoSuporte } from "@/lib/types";

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

/** Chamados de suporte do período, do sistema do contrato (o "Nome no Fortics" do sistema vai como filtro). */
async function buscarSuporte(c: ConteudoRelatorio, atualizar: boolean): Promise<ResumoSuporte> {
  return buscarResumoSuporte(c.cliente, c.relatorio.de, c.relatorio.ate, (await buscarSistema(c.contrato.sistema))?.nomeFortics, atualizar);
}

/** Conteúdo do relatório como o PDF e a página do aprovador mostram: visitas, chamados e cronograma de agora. */
async function montarCongelado(c: ConteudoRelatorio, suporte: ResumoSuporte, agora: Date): Promise<ConteudoCongelado> {
  const conteudo = congelar(c);
  conteudo.suporte = suporte;
  // Cronograma de implantação do contrato, na situação do dia: o cliente vê o mesmo na página e no PDF.
  conteudo.cronograma = await congelarCronograma(c.contrato.id, dataLocal(agora.getTime()));
  return conteudo;
}

/**
 * Gera o PDF da versão e a registra (v1, v2…). Não envia nada e não exige aprovador nem CNPJ: o PDF pode ser baixado e enviado por
 * fora. Pode ser feito de novo a qualquer momento antes da aprovação, e cada vez vira uma versão nova. O envio por e-mail é à parte.
 */
export async function emitirRelatorio(id: string) {
  let c = await montarConteudo(id);
  if (!c) throw new Error("Relatório não encontrado");
  if (!podeAtualizarRelatorio(c.relatorio.status)) throw new Error("Este relatório não pode ser emitido agora");

  // Os chamados são buscados de novo na emissão: o número congelado na versão é o de agora.
  const suporte = await buscarSuporte(c, true);
  // Sem visitas, o relatório sai só com os chamados de suporte; só não sai se não deu para consultá-los.
  const pode = conteudoParaEmitir(c.visitas.length, suporte);
  if (!pode.ok) return { erro: pode.motivo };

  // A versão congelada é o que o cliente vê: converte antes os locais que ainda estão sem CEP.
  if ((await preencherCepsPendentes(c.visitas)) > 0) {
    c = await montarConteudo(id);
    if (!c) throw new Error("Relatório não encontrado");
  }

  const agora = new Date();
  const conteudo = await montarCongelado(c, suporte, agora);
  const numero = c.relatorio.versoes.length + 1;
  const pdf = await renderToBuffer(
    <RelatorioPdf conteudo={conteudo} versao={numero} emitidoEm={agora.toISOString()} imagens={await carregarImagens(conteudo)} marca={await carregarMarcaPdf()} />,
  );
  const arquivo = await salvarArquivo(pdf, "application/pdf");
  const { versao } = await registrarEmissao(id, { conteudo, pdfUrl: arquivo.url, pdfTamanho: pdf.length, emitidoEm: agora.toISOString() });
  return { versao: versao.numero, tamanho: pdf.length };
}

/** PDF de prévia do relatório com os dados de agora, sem registrar versão nenhuma. Nunca é bloqueado: mostra o que houver. */
export async function gerarPrevia(id: string): Promise<{ pdf: Buffer; nome: string } | null> {
  const c = await montarConteudo(id);
  if (!c) return null;
  const agora = new Date();
  const conteudo = await montarCongelado(c, await buscarSuporte(c, false), agora);
  const versao = c.relatorio.versoes.length + 1;
  const pdf = await renderToBuffer(
    <RelatorioPdf conteudo={conteudo} versao={versao} emitidoEm={agora.toISOString()} imagens={await carregarImagens(conteudo)} marca={await carregarMarcaPdf()} previa />,
  );
  return { pdf, nome: nomeDoArquivoPdf({ tipo: conteudo.relatorioAtendimentos, cliente: conteudo.cliente.nome, sistema: conteudo.sistema.nome, de: conteudo.de, ate: conteudo.ate, versao, previa: true }) };
}

/** Envia por e-mail a última versão emitida aos aprovadores ativos do contrato (com o PDF e o botão "Ver relatório"). Pode reenviar. */
export async function enviarRelatorio(id: string) {
  const r = await buscarRelatorio(id);
  if (!r) throw new Error("Relatório não encontrado");
  if (!podeEnviarRelatorio(r.status)) return { erro: "Emita a versão antes de enviar." };
  const ultima = r.versoes.at(-1);
  if (!ultima?.conteudo || !ultima.pdfUrl) return { erro: "A última versão não tem PDF. Emita de novo." };

  let enviado;
  try {
    enviado = await registrarEnvio(id);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível enviar." };
  }
  const { versao, links } = enviado;
  const conteudo = ultima.conteudo;
  const periodo = `${formatarDataCurta(conteudo.de)} a ${formatarDataCurta(conteudo.ate)}`;
  const anexa = ultima.pdfTamanho <= LIMITE_ANEXO;
  const nomePdf = nomeDoArquivoPdf({ tipo: conteudo.relatorioAtendimentos, cliente: conteudo.cliente.nome, sistema: conteudo.sistema.nome, de: conteudo.de, ate: conteudo.ate, versao: versao.numero });
  let falhas = 0;
  for (const l of links) {
    const resultado = await enviarEmail({
      para: { nome: l.aprovadorNome, email: l.aprovadorEmail },
      assunto: `${nomeDoRelatorio({ tipo: conteudo.relatorioAtendimentos, cliente: conteudo.cliente.nome, sistema: conteudo.sistema.nome, de: conteudo.de, ate: conteudo.ate, versao: versao.numero })}`,
      html: [
        `<p>Olá, ${esc(l.aprovadorNome)}.</p>`,
        `<p>Segue o relatório de atendimento da SIDIM referente ao sistema <b>${esc(conteudo.sistema.nome)}</b>, período de <b>${periodo}</b>${versao.numero > 1 ? `, versão <b>v${versao.numero}</b> (atualizada)` : ""}.</p>`,
        `<p>${conteudo.visitas.length === 0 ? "Nenhuma visita registrada no período; o relatório traz os chamados de suporte atendidos" : conteudo.visitas.length === 1 ? "1 visita registrada" : `${conteudo.visitas.length} visitas registradas`}. ${anexa ? "O PDF segue em anexo." : "O PDF ficou grande para anexar; baixe-o pela página do relatório."}</p>`,
        `<p>Use o botão abaixo para ver o relatório completo e <b>aprovar</b> ou <b>pedir ajuste</b>. Basta a decisão de um dos aprovadores.</p>`,
      ].join(""),
      anexos: anexa ? [{ nome: nomePdf, url: ultima.pdfUrl, tamanho: ultima.pdfTamanho }] : [],
      botao: { texto: "Ver relatório", url: `${urlBase()}/aprovacao/${l.token}` },
      relatorioId: id,
    });
    if (resultado.situacao === "falhou") falhas++;
  }
  return { versao: versao.numero, destinatarios: links.length, falhas, anexado: anexa };
}
