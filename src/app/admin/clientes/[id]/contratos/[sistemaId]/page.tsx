import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buscarCliente, buscarSistemaDoCliente } from "@/lib/repo/clientes";
import { buscarContratoDoSistemaDoCliente } from "@/lib/repo/contratos";
import { listarAprovadores } from "@/lib/repo/aprovadores";
import { PageHeader } from "@/components/shell/placeholder";
import { ContratoForm } from "./contrato-form";
import { salvarContratoDoSistema } from "../../../contrato-actions";

export default function ContratoPage({ params }: PageProps<"/admin/clientes/[id]/contratos/[sistemaId]">) {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/admin/clientes/[id]/contratos/[sistemaId]">, "params">) {
  const { id, sistemaId } = await params;
  const [cliente, sdc, contrato] = await Promise.all([buscarCliente(id), buscarSistemaDoCliente(sistemaId), buscarContratoDoSistemaDoCliente(sistemaId)]);
  if (!cliente || !sdc || sdc.clienteId !== id) notFound();

  // Todos os aprovadores ativos, mais os inativos que o contrato ainda cita (aparecem marcados, para poder tirar).
  const ativos = await listarAprovadores();
  const doContrato = contrato?.aprovadores ?? [];
  const lista = [...ativos, ...doContrato.filter((a) => !a.ativo)].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <Link href={`/admin/clientes/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {cliente.nome}
      </Link>
      <PageHeader
        titulo={`${contrato ? "Contrato" : "Novo contrato"} · ${sdc.sistemaNome}`}
        descricao={`${cliente.nome}. O contrato vale para o sistema ${sdc.sistemaNome}: capa do relatório, forma de comprovação, CPF e aprovadores.`}
      />
      <ContratoForm
        acao={salvarContratoDoSistema.bind(null, id, sistemaId)}
        clienteId={id}
        contrato={contrato ? { texto: contrato.texto, nivel: contrato.nivel, exigeCpf: contrato.exigeCpf, ativo: contrato.ativo, aprovadorIds: contrato.aprovadorIds } : undefined}
        aprovadores={lista}
      />
    </>
  );
}
