import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, LayoutDashboard, LogOut, Smartphone } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { acessoAdministracao, acessoTecnico } from "@/lib/permissoes";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Início · SIDIM Visitas" };

export default function InicioPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">SIDIM Visitas</h1>
        </div>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
          <Conteudo />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Decide a área pelas permissões: uma só abre direto; as duas mostram o seletor; nenhuma avisa que não há acesso.
 * É para cá que o DAL manda quem tentou abrir uma área que não pode usar.
 */
async function Conteudo() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/sair");
  const admin = acessoAdministracao(usuario.permissoes);
  const tecnico = acessoTecnico(usuario.permissoes);

  if (admin && !tecnico) redirect("/admin");
  if (tecnico && !admin) redirect("/tecnico");

  if (!admin && !tecnico) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sem acesso ao ReportS</CardTitle>
          <CardDescription>
            Seu usuário ({usuario.nome}) não tem nenhuma permissão do ReportS. Fale com a coordenação para liberar o acesso.
          </CardDescription>
          <Link href="/sair" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <LogOut className="size-4" />
            Sair
          </Link>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">Olá, {usuario.nome.split(" ")[0]}. Para onde você quer ir?</p>
      <Link href="/admin" className="group block">
        <Card className="transition-colors group-hover:ring-primary/40">
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="size-4" />
            </div>
            <CardTitle>Administração</CardTitle>
            <CardDescription>Clientes, visitas, relatórios e o que mais as suas permissões liberam.</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href="/tecnico" className="group block">
        <Card className="transition-colors group-hover:ring-primary/40">
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </div>
            <CardTitle>App do Técnico</CardTitle>
            <CardDescription>Check-in, visita, participantes e check-out.</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <div className="text-center">
        <Link href="/sair" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <LogOut className="size-3.5" />
          Sair
        </Link>
      </div>
    </div>
  );
}
