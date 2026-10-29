"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Mail,
  Menu,
  Timer,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const GRUPOS: { titulo?: string; itens: NavItem[] }[] = [
  { itens: [{ href: "/admin", label: "Início", icon: LayoutDashboard }] },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/admin/usuarios", label: "Usuários", icon: UserCog },
      { href: "/admin/clientes", label: "Clientes", icon: Building2 },
      { href: "/admin/aprovadores", label: "Aprovadores", icon: BadgeCheck },
      { href: "/admin/temas", label: "Temas", icon: BookOpen },
      { href: "/admin/participantes", label: "Participantes", icon: Users },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/admin/visitas", label: "Visitas", icon: Timer },
      { href: "/admin/relatorios", label: "Relatórios", icon: FileText },
      { href: "/admin/emails", label: "Caixa de saída (teste)", icon: Mail },
    ],
  },
];

function Marca() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ClipboardCheck className="size-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">SIDIM Visitas</div>
        <div className="text-xs text-muted-foreground">Administração</div>
      </div>
    </div>
  );
}

/** Links do menu; `path` destaca o item ativo (ausente no HTML pré-renderizado). */
function LinksBase({ path, onNavigate }: { path?: string; onNavigate?: () => void }) {
  const ativo = (href: string) => !!path && (href === "/admin" ? path === href : path.startsWith(href));

  return (
    <nav className="flex flex-col gap-5">
      {GRUPOS.map((g, i) => (
        <div key={i} className="flex flex-col gap-1">
          {g.titulo && (
            <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {g.titulo}
            </div>
          )}
          {g.itens.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                ativo(href)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function LinksAtivos({ onNavigate }: { onNavigate?: () => void }) {
  return <LinksBase path={usePathname()} onNavigate={onNavigate} />;
}

// A rota atual só existe em tempo de execução: o menu sai sem destaque e o destaque entra em seguida.
function Links({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<LinksBase onNavigate={onNavigate} />}>
      <LinksAtivos onNavigate={onNavigate} />
    </Suspense>
  );
}

/** Menu lateral fixo no desktop. */
export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
      <Marca />
      <Links />
    </aside>
  );
}

/** Botão que abre o menu em gaveta em telas menores. */
export function AdminMobileNav() {
  const [aberto, setAberto] = useState(false);
  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="gap-6 p-4">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Marca />
        <Links onNavigate={() => setAberto(false)} />
      </SheetContent>
    </Sheet>
  );
}
