import { Suspense } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { listarClientes } from "@/lib/repo/clientes";
import { listarContratos } from "@/lib/repo/contratos";
import { formatarCnpj } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClientesPage({ searchParams }: PageProps<"/admin/clientes">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo="Clientes" descricao="Clientes atendidos, os sistemas que usam e os contratos, os estabelecimentos e os aprovadores de cada um." />
        <Button nativeButton={false} render={<Link href="/admin/clientes/novo" />} className="h-9">
          <Plus />
          Novo cliente
        </Button>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <ListaClientes searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaClientes({ searchParams }: Pick<PageProps<"/admin/clientes">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [clientes, contratos] = await Promise.all([listarClientes(q), listarContratos()]);

  return (
    <>
      <form className="relative mb-4 w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou CNPJ" className="h-9 bg-background pl-8" />
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Cliente</TableHead>
                <TableHead>Sistemas</TableHead>
                <TableHead className="text-center">Estabelecimentos</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              )}
              {clientes.map((c) => (
                <TableRow key={c.id} className={cn(!c.ativo && "text-muted-foreground")}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.nome}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.cnpj ? formatarCnpj(c.cnpj) : "CNPJ pendente"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.sistemas.length === 0 && <span className="text-xs text-muted-foreground">Nenhum</span>}
                      {c.sistemas.map((x) => {
                        const contrato = contratos.find((k) => k.sistemaDoClienteId === x.id);
                        return (
                          <Badge key={x.id} variant={contrato?.ativo ? "secondary" : "outline"} title={contrato ? (contrato.ativo ? "Contrato ativo" : "Contrato inativo") : "Contrato pendente"}>
                            {x.sistemaNome}
                            {!contrato && " · sem contrato"}
                            {contrato && !contrato.ativo && " · inativo"}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{c.totalUnidades}</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? "outline" : "destructive"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/clientes/${c.id}`} />}>
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}.
      </p>
    </>
  );
}
