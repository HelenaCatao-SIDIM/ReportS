import { Suspense } from "react";
import { listarClientes } from "@/lib/repo/clientes";
import { horaDoServidor } from "@/lib/agora";
import { periodosRapidos } from "@/lib/datas";
import { PageHeader } from "@/components/shell/placeholder";
import { NovoRelatorioForm } from "./novo-form";

export default function NovoRelatorioPage() {
  return (
    <>
      <PageHeader titulo="Novo relatório" descricao="Escolha o cliente e o período (em geral, um mês)." />
      <Suspense fallback={<div className="h-80 max-w-xl animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </>
  );
}

async function Formulario() {
  const [clientes, agora] = await Promise.all([listarClientes(), horaDoServidor()]);
  const p = periodosRapidos(agora);
  return (
    <NovoRelatorioForm
      clientes={clientes.filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }))}
      mesPassado={p.mesPassado}
      mesAtual={p.mes}
    />
  );
}
