import { Suspense } from "react";
import { notFound } from "next/navigation";
import { buscarPorId } from "@/lib/repo/usuarios";
import { getUsuarioAtual } from "@/lib/dal";
import { PageHeader } from "@/components/shell/placeholder";
import { UsuarioForm } from "../usuario-form";
import { editar } from "../actions";

export default function EditarUsuarioPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  return (
    <>
      <PageHeader titulo="Editar usuário" />
      <Suspense fallback={<div className="h-80 max-w-2xl animate-pulse rounded-xl bg-muted" />}>
        <Formulario params={params} />
      </Suspense>
    </>
  );
}

async function Formulario({ params }: Pick<PageProps<"/admin/usuarios/[id]">, "params">) {
  const { id } = await params;
  const [usuario, eu] = await Promise.all([buscarPorId(id), getUsuarioAtual()]);
  if (!usuario) notFound();

  return <UsuarioForm acao={editar.bind(null, id)} usuario={usuario} ehVoceMesmo={usuario.id === eu?.id} />;
}
