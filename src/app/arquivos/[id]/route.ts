import { readSession } from "@/lib/session";
import { lerArquivo } from "@/lib/repo/arquivos";

/** Serve imagens guardadas, só para usuários logados. (O aprovador verá as fotos pelo relatório.) */
export async function GET(_: Request, { params }: RouteContext<"/arquivos/[id]">) {
  if (!(await readSession())) return new Response("Não autorizado", { status: 401 });
  const arquivo = await lerArquivo((await params).id);
  if (!arquivo) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(arquivo.dados), {
    headers: { "Content-Type": arquivo.tipo, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
