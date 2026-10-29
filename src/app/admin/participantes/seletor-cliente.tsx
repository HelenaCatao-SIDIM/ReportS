"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { selectClass } from "@/components/form/campo";

interface ClienteOpcao {
  id: string;
  nome: string;
  sistemas: { id: string; nome: string }[];
}

/** Troca o cliente ou o sistema da lista (vai para ?cliente=id&sistema=id, limpando a busca). */
export function SeletorParticipantes({ clientes, clienteAtual, sistemaAtual }: { clientes: ClienteOpcao[]; clienteAtual: string; sistemaAtual: string }) {
  const router = useRouter();
  const cliente = clientes.find((c) => c.id === clienteAtual);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        aria-label="Cliente"
        value={clienteAtual}
        onChange={(e) => {
          const novo = clientes.find((c) => c.id === e.target.value);
          router.push(`/admin/participantes?cliente=${e.target.value}${novo?.sistemas[0] ? `&sistema=${novo.sistemas[0].id}` : ""}`);
        }}
        className={cn(selectClass, "bg-background font-medium sm:w-72")}
      >
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <select
        aria-label="Sistema"
        value={sistemaAtual}
        onChange={(e) => router.push(`/admin/participantes?cliente=${clienteAtual}&sistema=${e.target.value}`)}
        className={cn(selectClass, "bg-background font-medium sm:w-44")}
      >
        {cliente?.sistemas.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
