import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
import { buscarCliente, listarUnidades } from "@/lib/repo/clientes";
import { formatarCnpj } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Unidades } from "./unidades";

const MENSAGENS: Record<string, string> = {
  criado: "Cliente criado. Agora cadastre as unidades e os setores.",
  salvo: "Dados do cliente salvos.",
};

export default function ClientePage({ params, searchParams }: PageProps<"/admin/clientes/[id]">) {
  return (
    <>
      <Link href="/admin/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Clientes
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/admin/clientes/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [cliente, unidades] = await Promise.all([buscarCliente(id), listarUnidades(id)]);
  if (!cliente) notFound();
  const ok = typeof sp.ok === "string" ? MENSAGENS[sp.ok] : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {cliente.nome}
            {!cliente.ativo && <Badge variant="destructive">Inativo</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">CNPJ {formatarCnpj(cliente.cnpj)}</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href={`/admin/clientes/${id}/editar`} />}>
          <Pencil />
          Editar dados
        </Button>
      </div>

      {ok && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">{ok}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Contrato e comprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Item rotulo="Contrato (capa do relatório)">{cliente.contrato}</Item>
              </div>
              <Item rotulo="Nível de comprovação">
                <Badge variant={cliente.nivel === "assinado" ? "default" : "secondary"}>
                  {cliente.nivel === "assinado" ? "Assinado" : "Nominal"}
                </Badge>
                <span className="ml-2 text-xs text-muted-foreground">
                  {cliente.nivel === "assinado" ? "participantes assinam na tela" : "basta a lista"}
                </span>
              </Item>
              <Item rotulo="CPF dos participantes">{cliente.exigeCpf ? "Exigido" : "Não exigido"}</Item>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Aprovadores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {cliente.aprovadores.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="font-medium">{a.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.cargo ? `${a.cargo} · ` : ""}
                    {a.email}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Unidades clienteId={id} unidades={unidades} />
    </div>
  );
}
