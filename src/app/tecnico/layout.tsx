import { AreaProtegida, UsuarioHeader } from "@/components/shell/area-protegida";
import { TecnicoBottomNav } from "@/components/shell/tecnico-nav";
import { OcultoNaPresenca } from "@/components/shell/oculto-na-presenca";
import { LogoReports } from "@/components/shell/logo-reports";

export default function TecnicoLayout({ children }: LayoutProps<"/tecnico">) {
  return (
    <div className="min-h-svh bg-muted/30 pb-20">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <LogoReports altura={26} />
          <OcultoNaPresenca>
            <UsuarioHeader area="tecnico" />
          </OcultoNaPresenca>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5">
        <AreaProtegida area="tecnico">{children}</AreaProtegida>
      </main>
      <OcultoNaPresenca>
        <TecnicoBottomNav />
      </OcultoNaPresenca>
    </div>
  );
}
