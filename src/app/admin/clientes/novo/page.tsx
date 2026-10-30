import { Suspense } from "react";
import { exigirAdministracao } from "@/lib/dal";
import { PERMISSOES } from "@/lib/permissoes";
import { listarSistemas } from "@/lib/repo/sistemas";
import { PageHeader } from "@/components/shell/placeholder";
import { ClienteForm } from "../cliente-form";
import { criarCliente } from "../actions";
import { chamadosSuporte } from "@/lib/config-suporte";

export default function NovoClientePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader titulo="Novo cliente" descricao="Depois de criar, você cadastra o contrato de cada sistema e os estabelecimentos do cliente." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </div>
  );
}

async function Formulario() {
  await exigirAdministracao(PERMISSOES.clientesCadastrar);
  return <ClienteForm acao={criarCliente} chamadosAtivos={chamadosSuporte()} sistemasDisponiveis={await listarSistemas()} />;
}
