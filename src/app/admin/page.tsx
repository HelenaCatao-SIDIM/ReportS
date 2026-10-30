import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, BadgeCheck, Building2, FileText, ShieldCheck, Timer, Users, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/placeholder";
import { exigirAdministracao } from "@/lib/dal";
import { PERMISSOES_DA_TELA, temAlguma } from "@/lib/permissoes";

const ATALHOS = [
  { href: "/admin/usuarios", titulo: "Usuários e permissões", desc: "Gerenciados no SINC", icon: ShieldCheck },
  { href: "/admin/clientes", titulo: "Clientes", desc: "Sistemas e contratos, estabelecimentos e setores", icon: Building2 },
  { href: "/admin/aprovadores", titulo: "Aprovadores", desc: "Quem aprova os relatórios de cada contrato", icon: BadgeCheck },
  { href: "/admin/temas", titulo: "Temas", desc: "Assuntos trabalhados nas visitas", icon: BookOpen },
  { href: "/admin/participantes", titulo: "Participantes", desc: "Pessoas treinadas por cliente", icon: Users },
  { href: "/admin/visitas", titulo: "Visitas", desc: "Em andamento, encerramento e correções", icon: Timer },
  { href: "/admin/relatorios", titulo: "Relatórios", desc: "Emissão e aprovação", icon: FileText },
];

export default function AdminHome({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const [usuario, sp] = await Promise.all([exigirAdministracao(), searchParams]);
  // Só as telas que as permissões do usuário liberam.
  const atalhos = ATALHOS.filter((a) => !PERMISSOES_DA_TELA[a.href] || temAlguma(usuario.permissoes, PERMISSOES_DA_TELA[a.href]));
  return (
    <>
      <PageHeader titulo={`Olá, ${usuario.nome.split(" ")[0]}`} descricao="Escolha uma área para começar." />
      {sp.negado && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <TriangleAlert />
          <AlertDescription className="text-amber-900">Você não tem permissão para abrir essa tela. Peça à coordenação para liberar o acesso no SINC.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {atalhos.map(({ href, titulo, desc, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors group-hover:ring-primary/40">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <CardTitle>{titulo}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
