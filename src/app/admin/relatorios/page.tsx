import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Plus } from "lucide-react";
import { listarRelatorios } from "@/lib/repo/relatorios";
import { listarClientes } from "@/lib/repo/clientes";
import { formatarDataHora } from "@/lib/datas";
import { formatarDataCurta } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { selectClass } from "@/components/form/campo";
import { StatusRelatorioBadge } from "@/components/relatorio/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RelatoriosPage({ searchParams }: PageProps<"/admin/relatorios">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo="Relatórios" descricao="Relatórios por cliente e período. Aprovado pelo cliente = liberado para faturar." />
        <Button nativeButton={false} render={<Link href="/admin/relatorios/novo" />} className="h-9">
          <Plus />
          Novo relatório
        </Button>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function Lista({ searchParams }: Pick<PageProps<"/admin/relatorios">, "searchParams">) {
  const sp = await searchParams;
  const f = { cliente: str(sp.cliente), de: str(sp.de), ate: str(sp.ate) };
  const [relatorios, clientes] = await Promise.all([
    listarRelatorios({ clienteId: f.cliente || undefined, de: f.de || undefined, ate: f.ate || undefined }),
    listarClientes(),
  ]);

  return (
    <>
      {sp.ok === "excluido" && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">Rascunho excluído. As visitas ficaram livres para outro relatório.</AlertDescription>
        </Alert>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <select name="cliente" defaultValue={f.cliente} aria-label="Cliente" className={cn(selectClass, "w-auto bg-background")}>
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">
          De
          <Input type="date" name="de" defaultValue={f.de} className="h-9 bg-background" />
        </label>
        <label className="text-xs text-muted-foreground">
          Até
          <Input type="date" name="ate" defaultValue={f.ate} className="h-9 bg-background" />
        </label>
        <Button type="submit" variant="outline" className="h-9">
          Filtrar
        </Button>
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Versão</TableHead>
                <TableHead className="text-center">Visitas</TableHead>
                <TableHead>Status / faturamento</TableHead>
                <TableHead>Última movimentação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatorios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum relatório encontrado.
                  </TableCell>
                </TableRow>
              )}
              {relatorios.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 font-medium">{r.clienteNome}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatarDataCurta(r.de)} a {formatarDataCurta(r.ate)}
                  </TableCell>
                  <TableCell className="text-center">{r.versaoAtual ? `v${r.versaoAtual}` : "—"}</TableCell>
                  <TableCell className="text-center">{r.visitaIds.length}</TableCell>
                  <TableCell>
                    <StatusRelatorioBadge status={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatarDataHora(r.atualizadoEm)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/relatorios/${r.id}`} />}>
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
        {relatorios.length} {relatorios.length === 1 ? "relatório" : "relatórios"}. O status muda sozinho para &quot;Liberado para faturar&quot; quando o cliente aprova.
      </p>
    </>
  );
}
