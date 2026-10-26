import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import type { UsuarioPublico } from "@/lib/types";

/** Nome do usuário e botão de sair — presente no cabeçalho de todas as telas. */
export function UserMenu({ usuario }: { usuario: UsuarioPublico }) {
  const iniciais = usuario.nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-sm font-medium">{usuario.nome}</div>
        <div className="text-xs capitalize text-muted-foreground">{usuario.perfil === "gestor" ? "Gestor" : "Técnico"}</div>
      </div>
      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {iniciais}
      </div>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Sair">
          <LogOut />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </form>
    </div>
  );
}
