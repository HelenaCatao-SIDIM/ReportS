"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { History, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/tecnico", label: "Visita", icon: MapPin },
  { href: "/tecnico/visitas", label: "Minhas visitas", icon: History },
];

function ItensBase({ path }: { path?: string }) {
  return (
    <div className="mx-auto flex max-w-lg">
      {ITENS.map(({ href, label, icon: Icon }) => {
        const ativo = !!path && (href === "/tecnico" ? path === href : path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
              ativo ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function ItensAtivos() {
  return <ItensBase path={usePathname()} />;
}

/** Barra de navegação inferior do App do Técnico (celular). */
export function TecnicoBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <Suspense fallback={<ItensBase />}>
        <ItensAtivos />
      </Suspense>
    </nav>
  );
}
