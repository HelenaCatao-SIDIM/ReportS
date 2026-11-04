import { getUsuarioAtual } from "@/lib/dal";
import { PERMISSOES, temAlguma } from "@/lib/permissoes";
import { modeloPlanilha } from "@/lib/planilha-cronograma";

/** Modelo da planilha de importação do cronograma, só para quem pode importar. */
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return new Response("Não autorizado", { status: 401 });
  if (!temAlguma(usuario.permissoes, [PERMISSOES.contratosGerenciar])) return new Response("Acesso negado", { status: 403 });
  return new Response(new Uint8Array(await modeloPlanilha()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-cronograma.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
