import { Suspense } from "react";
import { notFound } from "next/navigation";
import { buscarCliente } from "@/lib/repo/clientes";
import { PageHeader } from "@/components/shell/placeholder";
import { ClienteForm } from "../../cliente-form";
import { editarCliente } from "../../actions";
import { chamadosSuporte } from "@/lib/config-suporte";

export default function EditarClientePage({ params }: PageProps<"/admin/clientes/[id]/editar">) {
  return (
    <div className="max-w-3xl">
      <PageHeader titulo="Editar cliente" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Formulario params={params} />
      </Suspense>
    </div>
  );
}

async function Formulario({ params }: Pick<PageProps<"/admin/clientes/[id]/editar">, "params">) {
  const { id } = await params;
  const cliente = await buscarCliente(id);
  if (!cliente) notFound();
  return <ClienteForm acao={editarCliente.bind(null, id)} cliente={cliente} chamadosAtivos={chamadosSuporte()} />;
}
