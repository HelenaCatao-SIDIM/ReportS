import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Search } from "lucide-react";
import { listarUsuarios } from "@/lib/repo/usuarios";
import { getUsuarioAtual } from "@/lib/dal";
import { formatarTelefone } from "@/lib/format";
import type { Perfil } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoAtivo } from "@/components/form/botao-ativo";
import { alternarAtivo } from "./actions";

const FILTROS: { valor?: Perfil; label: string }[] = [
  { label: "Todos" },
  { valor: "tecnico", label: "Técnicos" },
  { valor: "gestor", label: "Gestores" },
];

const MENSAGENS: Record<string, string> = { criado: "Usuário criado.", salvo: "Alterações salvas." };

export default function UsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader titulo="Usuários" descricao="Técnicos e gestores com acesso ao sistema." />
        <Button nativeButton={false} render={<Link href="/admin/usuarios/novo" />} className="h-9">
          <Plus />
          Novo usuário
        </Button>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <ListaUsuarios searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaUsuarios({ searchParams }: Pick<PageProps<"/admin/usuarios">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const perfil = sp.perfil === "tecnico" || sp.perfil === "gestor" ? sp.perfil : undefined;
  const ok = typeof sp.ok === "string" ? MENSAGENS[sp.ok] : undefined;

  const [usuarios, eu] = await Promise.all([listarUsuarios({ busca: q, perfil }), getUsuarioAtual()]);

  const link = (p?: Perfil) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p) params.set("perfil", p);
    const s = params.toString();
    return `/admin/usuarios${s ? `?${s}` : ""}`;
  };

  return (
    <>
      {ok && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertDescription className="text-emerald-800">{ok}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nome" className="h-9 bg-background pl-8" />
          {perfil && <input type="hidden" name="perfil" value={perfil} />}
        </form>
        <div className="flex gap-1 rounded-lg border bg-background p-1">
          {FILTROS.map((f) => (
            <Link
              key={f.label}
              href={link(f.valor)}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                perfil === f.valor ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
              {usuarios.map((u) => (
                <TableRow key={u.id} className={cn(!u.ativo && "text-muted-foreground")}>
                  <TableCell className="pl-4 font-medium">
                    {u.nome}
                    {u.id === eu?.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="whitespace-nowrap">{u.telefone ? formatarTelefone(u.telefone) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.perfil === "gestor" ? "default" : "secondary"}>
                      {u.perfil === "gestor" ? "Gestor" : "Técnico"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "outline" : "destructive"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/usuarios/${u.id}`} />}>
                      Editar
                    </Button>
                    {u.id !== eu?.id && (
                      <BotaoAtivo
                        ativo={u.ativo}
                        confirmacao={`Inativar ${u.nome}? A pessoa não conseguirá mais entrar no sistema.`}
                        acao={alternarAtivo.bind(null, u.id, !u.ativo)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {usuarios.length} {usuarios.length === 1 ? "usuário" : "usuários"}. Usuários inativos não entram no sistema, mas o histórico deles é mantido.
      </p>
    </>
  );
}
