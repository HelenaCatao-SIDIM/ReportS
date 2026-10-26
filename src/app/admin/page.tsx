import Link from "next/link";
import { BookOpen, Building2, FileText, Timer, UserCog, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/placeholder";
import { getUsuarioAtual } from "@/lib/dal";

const ATALHOS = [
  { href: "/admin/usuarios", titulo: "Usuários", desc: "Técnicos e gestores com acesso", icon: UserCog },
  { href: "/admin/clientes", titulo: "Clientes", desc: "Aprovadores, unidades e setores", icon: Building2 },
  { href: "/admin/temas", titulo: "Temas", desc: "Assuntos trabalhados nas visitas", icon: BookOpen },
  { href: "/admin/participantes", titulo: "Participantes", desc: "Pessoas treinadas por cliente", icon: Users },
  { href: "/admin/visitas", titulo: "Visitas", desc: "Em andamento, encerramento e correções", icon: Timer },
  { href: "/admin/relatorios", titulo: "Relatórios", desc: "Emissão e aprovação", icon: FileText },
];

export default async function AdminHome() {
  const usuario = await getUsuarioAtual();
  return (
    <>
      <PageHeader titulo={`Olá, ${usuario?.nome.split(" ")[0]}`} descricao="Escolha uma área para começar." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ATALHOS.map(({ href, titulo, desc, icon: Icon }) => (
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
