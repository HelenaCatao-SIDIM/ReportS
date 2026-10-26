"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Inativa (pedindo confirmação) ou reativa um registro direto da lista. `acao` é uma Server Action já vinculada. */
export function BotaoAtivo({ ativo, confirmacao, acao }: { ativo: boolean; confirmacao: string; acao: () => Promise<void> }) {
  const [pending, start] = useTransition();

  function onClick() {
    if (ativo && !confirm(confirmacao)) return;
    start(() => acao());
  }

  return (
    <Button variant={ativo ? "ghost" : "outline"} size="sm" onClick={onClick} disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {ativo ? "Inativar" : "Reativar"}
    </Button>
  );
}
