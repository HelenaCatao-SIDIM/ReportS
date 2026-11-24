import { getUsuarioAtual } from "@/lib/dal";
import { PERMISSOES, temAlguma } from "@/lib/permissoes";
import { buscarVisitasDetalhadas } from "@/lib/repo/visitas";
import { gerarRelatorioDeVisitas } from "@/lib/emissao";
import { cabecalhoDeDownload } from "@/lib/nome-pdf";

/** Teto de visitas por relatório avulso (evita um PDF gigante de uma vez). */
const LIMITE = 300;

/**
 * Baixa um relatório avulso em PDF só com as visitas escolhidas (sem atendimentos do suporte). Só a Administração que gerencia
 * visitas. Recebe `{ ids }` no corpo; só gera se todas forem visitas encerradas que existem.
 */
export async function POST(req: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !temAlguma(usuario.permissoes, [PERMISSOES.visitasGerenciar])) return new Response("Acesso negado", { status: 403 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("Requisição inválida.", { status: 400 });
  }
  const bruto = (corpo as { ids?: unknown })?.ids;
  const ids = Array.isArray(bruto) ? [...new Set(bruto.map((x) => String(x)))].slice(0, LIMITE) : [];
  if (!ids.length) return new Response("Escolha ao menos uma visita.", { status: 400 });

  // Só visitas encerradas que existem; se alguma sumiu ou não está encerrada, a lista mudou — recarregar.
  const visitas = (await buscarVisitasDetalhadas(ids)).filter((v) => v.status === "encerrada");
  if (visitas.length !== ids.length) return new Response("Alguma visita não está mais disponível. Atualize a página e tente de novo.", { status: 409 });

  const r = await gerarRelatorioDeVisitas(visitas, usuario.nome);
  if (!r) return new Response("Não foi possível gerar o relatório.", { status: 400 });
  return new Response(new Uint8Array(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": cabecalhoDeDownload(r.nome), "Cache-Control": "no-store" },
  });
}
