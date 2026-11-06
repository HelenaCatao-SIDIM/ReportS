import { getUsuarioAtual } from "@/lib/dal";
import { PERMISSOES, temAlguma } from "@/lib/permissoes";
import { cabecalhoDeDownload, nomeDoArquivoPdf } from "@/lib/nome-pdf";
import { lerArquivo } from "@/lib/repo/arquivos";
import { buscarCliente } from "@/lib/repo/clientes";
import { buscarRelatorio } from "@/lib/repo/relatorios";

/** Baixa o PDF de uma versão emitida, com o nome "Relatório Analítico - Cliente - Sistema - período - vN.pdf". */
export async function GET(_: Request, { params }: RouteContext<"/admin/relatorios/[id]/versoes/[numero]/pdf">) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !temAlguma(usuario.permissoes, [PERMISSOES.relatoriosGerenciar, PERMISSOES.visitasGerenciar])) return new Response("Acesso negado", { status: 403 });
  const { id, numero } = await params;
  const r = await buscarRelatorio(id);
  const v = r?.versoes.find((x) => x.numero === Number(numero));
  if (!r || !v?.pdfUrl || !v.pdfUrl.startsWith("/arquivos/")) return new Response("Não encontrado", { status: 404 });
  const arquivo = await lerArquivo(v.pdfUrl.slice("/arquivos/".length));
  if (!arquivo) return new Response("Não encontrado", { status: 404 });
  const cliente = (await buscarCliente(r.clienteId))?.nome ?? v.conteudo?.cliente.nome ?? "Cliente";
  const nome = nomeDoArquivoPdf({ tipo: v.conteudo?.relatorioAtendimentos, cliente, sistema: v.conteudo?.sistema.nome ?? "", de: r.de, ate: r.ate, versao: v.numero });
  return new Response(new Uint8Array(arquivo.dados), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": cabecalhoDeDownload(nome), "Cache-Control": "private, no-store" },
  });
}
