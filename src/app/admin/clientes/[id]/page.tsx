import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileSignature, Pencil, Plus } from "lucide-react";
import { buscarCliente, listarSistemasDoCliente, listarUnidades } from "@/lib/repo/clientes";
import { listarContratosDoCliente } from "@/lib/repo/contratos";
import { ROTULO_ESTADO, rotuloNivel } from "@/lib/contratos";
import { formatarCnpj } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Unidades } from "./unidades";
import { buscaCoordenadas } from "@/lib/config";
import { chamadosSuporte } from "@/lib/config-suporte";

const MENSAGENS: Record<string, string> = {
  criado: "Cliente criado. Agora cadastre o contrato de cada sistema e os estabelecimentos.",
  salvo: "Dados do cliente salvos.",
  contrato: "Contrato salvo.",
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
  const [cliente, unidades, sistemas, contratos] = await Promise.all([
    buscarCliente(id),
    listarUnidades(id),
    listarSistemasDoCliente(id),
    listarContratosDoCliente(id),
  ]);
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
          <p className="mt-1 text-sm text-muted-foreground">
            {cliente.cnpj ? `CNPJ ${formatarCnpj(cliente.cnpj)}` : "CNPJ pendente"} · {cliente.origem === "sinc" ? "veio do SINC" : "criado no ReportS"}
            {chamadosSuporte() && (
              <>
                {" "}
                · Nome no SINC (chamados de suporte): {cliente.nomesFortics.length ? cliente.nomesFortics.join(" · ") : "não informado"}
              </>
            )}
          </p>
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Sistemas e contratos</h2>
            <p className="text-sm text-muted-foreground">
              Cada sistema do cliente tem o seu contrato, a sua forma de comprovação e os seus aprovadores. Cliente com dois sistemas tem dois relatórios por período.
            </p>
          </div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/clientes/${id}/editar`} />}>
            <Plus />
            Acrescentar sistema
          </Button>
        </div>
        {sistemas.length === 0 && <Card className="items-center py-8 text-sm text-muted-foreground">Nenhum sistema cadastrado.</Card>}
        <div className="grid gap-4 lg:grid-cols-2">
          {sistemas.map((x) => {
            const contrato = contratos.find((k) => k.sistemaDoClienteId === x.id);
            return (
              <Card key={x.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {x.sistemaNome}
                    <Badge variant={x.estado === "vinculado" ? "default" : "secondary"}>{ROTULO_ESTADO[x.estado]}</Badge>
                    {contrato && !contrato.ativo && <Badge variant="destructive">Contrato inativo</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {x.tenantId ? `Tenant ${x.tenantId}` : "Ainda sem tenant: a ligação é feita no SINC quando o sistema entrar no ar."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contrato ? (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Item rotulo="Contrato (capa do relatório)">{contrato.texto}</Item>
                      </div>
                      <Item rotulo="Comprovação">
                        <Badge variant={contrato.nivel === "assinado" ? "default" : "secondary"}>{rotuloNivel(contrato.nivel)}</Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {contrato.nivel === "assinado" ? "participantes assinam na tela" : "basta a lista"}
                        </span>
                      </Item>
                      <Item rotulo="CPF dos participantes">{contrato.exigeCpf ? "Exigido" : "Não exigido"}</Item>
                      <div className="sm:col-span-2">
                        <Item rotulo="Aprovadores">
                          <ul className="space-y-1">
                            {contrato.aprovadores.map((a) => (
                              <li key={a.id} className={a.ativo ? "" : "text-muted-foreground line-through"}>
                                <span className="font-medium">{a.nome}</span>
                                <span className="text-xs text-muted-foreground">
                                  {" "}
                                  · {a.cargo ? `${a.cargo} · ` : ""}
                                  {a.email}
                                  {!a.ativo && " (inativo)"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </Item>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-amber-700">
                      Contrato pendente. Enquanto não for cadastrado, o técnico não consegue escolher este sistema no check-in.
                    </p>
                  )}
                  <Button variant={contrato ? "outline" : "default"} size="sm" nativeButton={false} render={<Link href={`/admin/clientes/${id}/contratos/${x.id}`} />}>
                    <FileSignature />
                    {contrato ? "Editar contrato" : "Cadastrar contrato"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Unidades clienteId={id} unidades={unidades} buscaAtiva={buscaCoordenadas()} />
    </div>
  );
}
