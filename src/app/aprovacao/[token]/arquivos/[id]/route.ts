import { lerArquivo } from "@/lib/repo/arquivos";
import { arquivosDaVersao, buscarPorLink } from "@/lib/repo/relatorios";
import { cabecalhoDeDownload, nomeDoArquivoPdf } from "@/lib/nome-pdf";

/**
 * Arquivos para o aprovador (sem login): só abre o que faz parte da versão do relatório deste link
 * (PDF, fotos e assinaturas). Qualquer outro arquivo do sistema responde 404.
 */
export async function GET(_: Request, { params }: RouteContext<"/aprovacao/[token]/arquivos/[id]">) {
  const { token, id } = await params;
  const acesso = await buscarPorLink(token);
  const url = `/arquivos/${id}`;
  if (!acesso || !arquivosDaVersao(acesso.versao).has(url)) return new Response("Não encontrado", { status: 404 });

  const arquivo = await lerArquivo(id);
  if (!arquivo) return new Response("Não encontrado", { status: 404 });
  const ehPdf = arquivo.tipo === "application/pdf";
  const c = acesso.versao.conteudo;
  const nomePdf = nomeDoArquivoPdf({ tipo: c?.relatorioAtendimentos, cliente: c?.cliente.nome ?? "Cliente", sistema: c?.sistema.nome ?? "", de: acesso.relatorio.de, ate: acesso.relatorio.ate, versao: acesso.versao.numero });
  return new Response(new Uint8Array(arquivo.dados), {
    headers: {
      "Content-Type": arquivo.tipo,
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
      ...(ehPdf ? { "Content-Disposition": cabecalhoDeDownload(nomePdf) } : {}),
    },
  });
}
