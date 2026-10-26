import { AdminMobileNav, AdminSidebar } from "@/components/shell/admin-nav";
import { AreaProtegida, UsuarioHeader } from "@/components/shell/area-protegida";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-svh bg-muted/30">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <AdminMobileNav />
          <div className="flex-1" />
          <UsuarioHeader perfil="gestor" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <AreaProtegida perfil="gestor">{children}</AreaProtegida>
        </main>
      </div>
    </div>
  );
}
