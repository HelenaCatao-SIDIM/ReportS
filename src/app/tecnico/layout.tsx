import { ClipboardCheck } from "lucide-react";
import { AreaProtegida, UsuarioHeader } from "@/components/shell/area-protegida";
import { TecnicoBottomNav } from "@/components/shell/tecnico-nav";

export default function TecnicoLayout({ children }: LayoutProps<"/tecnico">) {
  return (
    <div className="min-h-svh bg-muted/30 pb-20">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="size-4" />
            </div>
            <span className="text-sm font-semibold">SIDIM Visitas</span>
          </div>
          <UsuarioHeader perfil="tecnico" />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5">
        <AreaProtegida perfil="tecnico">{children}</AreaProtegida>
      </main>
      <TecnicoBottomNav />
    </div>
  );
}
