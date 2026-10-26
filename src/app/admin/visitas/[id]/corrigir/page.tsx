import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { buscarVisita } from "@/lib/repo/visitas";
import { listarUnidades } from "@/lib/repo/clientes";
import { listarTemas } from "@/lib/repo/temas";
import { formatarData } from "@/lib/datas";
import { PageHeader } from "@/components/shell/placeholder";
import { CorrecaoForm } from "./correcao-form";

export default function CorrigirVisitaPage({ params }: PageProps<"/admin/visitas/[id]/corrigir">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/admin/visitas/[id]/corrigir">, "params">) {
  const { id } = await params;
  const v = await buscarVisita(id);
  if (!v) notFound();
  // Só encerradas e fora de relatório aprovado; o técnico nunca chega aqui.
  if (v.status !== "encerrada" || v.travada) redirect(`/admin/visitas/${id}`);
  const [unidades, temas] = await Promise.all([listarUnidades(v.clienteId), listarTemas()]);

  return (
    <div className="max-w-5xl">
      <PageHeader titulo="Corrigir visita" descricao={`${v.clienteNome} · ${formatarData(v.entrada)} · ${v.tecnicoNome}`} />
      <CorrecaoForm visita={v} unidades={unidades} temas={temas} />
    </div>
  );
}
