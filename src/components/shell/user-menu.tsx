import Link from "next/link";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { acessoAdministracao, acessoTecnico } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/types";

/** Nome do usuário e botão de sair — presente no cabeçalho de todas as telas. */
export function UserMenu({ usuario }: { usuario: UsuarioLogado }) {
  // Quem tem as duas áreas troca de uma para a outra pelo seletor (RN-PL-74).
  const duasAreas = acessoAdministracao(usuario.permissoes) && acessoTecnico(usuario.permissoes);
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
        <div className="text-xs text-muted-foreground">{usuario.papeis.join(", ")}</div>
      </div>
      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {iniciais}
      </div>
      {duasAreas && (
        <Link href="/inicio" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeftRight className="size-4" />
          <span className="hidden sm:inline">Trocar de área</span>
        </Link>
      )}
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Sair">
          <LogOut />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </form>
    </div>
  );
}
