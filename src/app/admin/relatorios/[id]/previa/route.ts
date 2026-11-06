import { getUsuarioAtual } from "@/lib/dal";
import { PERMISSOES, temAlguma } from "@/lib/permissoes";
import { gerarPrevia } from "@/lib/emissao";
import { cabecalhoDeDownload } from "@/lib/nome-pdf";
import { buscarRelatorio } from "@/lib/repo/relatorios";

/** Baixa uma prévia do relatório em PDF, com os dados de agora e sem registrar versão. Só para quem gerencia relatórios. */
export async function GET(_: Request, { params }: RouteContext<"/admin/relatorios/[id]/previa">) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !temAlguma(usuario.permissoes, [PERMISSOES.relatoriosGerenciar])) return new Response("Acesso negado", { status: 403 });
  const { id } = await params;
  if (!(await buscarRelatorio(id))) return new Response("Não encontrado", { status: 404 });
  const previa = await gerarPrevia(id);
  if (!previa) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(previa.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": cabecalhoDeDownload(previa.nome), "Cache-Control": "no-store" },
  });
}
