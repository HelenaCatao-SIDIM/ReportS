import { Suspense } from "react";
import { listarClientes } from "@/lib/repo/clientes";
import { listarContratos } from "@/lib/repo/contratos";
import { horaDoServidor } from "@/lib/agora";
import { periodosRapidos } from "@/lib/datas";
import { PageHeader } from "@/components/shell/placeholder";
import { NovoRelatorioForm } from "./novo-form";

export default function NovoRelatorioPage() {
  return (
    <>
      <PageHeader titulo="Novo relatório" descricao="Escolha o cliente, o sistema (contrato) e o período (em geral, um mês). Cada sistema tem o seu relatório." />
      <Suspense fallback={<div className="h-80 max-w-xl animate-pulse rounded-xl bg-muted" />}>
        <Formulario />
      </Suspense>
    </>
  );
}

async function Formulario() {
  const [clientes, contratos, agora] = await Promise.all([listarClientes(), listarContratos(), horaDoServidor()]);
  const p = periodosRapidos(agora);
  return (
    <NovoRelatorioForm
      clientes={clientes
        .filter((c) => c.ativo)
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          contratos: contratos.filter((k) => k.clienteId === c.id).map((k) => ({ id: k.id, sistemaNome: k.ativo ? k.sistemaNome : `${k.sistemaNome} (contrato inativo)` })),
        }))
        .filter((c) => c.contratos.length > 0)}
      mesPassado={p.mesPassado}
      mesAtual={p.mes}
    />
  );
}
