import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listarAprovadores } from "@/lib/repo/aprovadores";
import { listarContratos } from "@/lib/repo/contratos";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { BotaoAtivo } from "@/components/form/botao-ativo";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AprovadorDialogo } from "./aprovador-dialogo";
import { alternarAprovador } from "./actions";

export default function AprovadoresPage({ searchParams }: PageProps<"/admin/aprovadores">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Aprovadores" descricao="Pessoas que aprovam os relatórios pelo link do e-mail." />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </>
      }
    >
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/admin/aprovadores">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [aprovadores, contratos] = await Promise.all([listarAprovadores({ busca: q, incluirInativos: true }), listarContratos()]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          titulo="Aprovadores"
          descricao="Pessoas que aprovam os relatórios pelo link do e-mail, sem login. Uma pessoa pode aprovar para vários contratos e clientes."
        />
        <AprovadorDialogo />
      </div>

      <form className="relative mb-4 w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, cargo ou e-mail" className="h-9 bg-background pl-8" />
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Aprovador</TableHead>
                <TableHead>Aprova para</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aprovadores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nenhum aprovador encontrado.
                  </TableCell>
                </TableRow>
              )}
              {aprovadores.map((a) => {
                const dele = contratos.filter((c) => c.aprovadorIds.includes(a.id));
                return (
                  <TableRow key={a.id} className={cn(!a.ativo && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <div className="font-medium">{a.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.cargo ? `${a.cargo} · ` : ""}
                        {a.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {dele.length === 0 && <span className="text-xs text-muted-foreground">Nenhum contrato</span>}
                        {dele.map((c) => (
                          <Link key={c.id} href={`/admin/clientes/${c.clienteId}/contratos/${c.sistemaDoClienteId}`}>
                            <Badge variant="secondary">
                              {c.clienteNome} · {c.sistemaNome}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.ativo ? "outline" : "destructive"}>{a.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right whitespace-nowrap">
                      <AprovadorDialogo aprovador={a} />
                      <BotaoAtivo
                        ativo={a.ativo}
                        confirmacao={`Inativar ${a.nome}? Ele deixa de receber os próximos relatórios, mas continua nas versões já enviadas.`}
                        acao={alternarAprovador.bind(null, a.id, !a.ativo)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {aprovadores.length} {aprovadores.length === 1 ? "aprovador" : "aprovadores"}.
      </p>
    </>
  );
}
