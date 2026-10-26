"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { selectClass } from "@/components/form/campo";

/** Troca o cliente da lista (vai para ?cliente=id, limpando a busca). */
export function SeletorCliente({ clientes, atual }: { clientes: { id: string; nome: string }[]; atual: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Cliente"
      value={atual}
      onChange={(e) => router.push(`/admin/participantes?cliente=${e.target.value}`)}
      className={cn(selectClass, "bg-background font-medium sm:w-72")}
    >
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}
