import { Label } from "@/components/ui/label";

/** Rótulo + controle + mensagem de erro (ou dica) — padrão de todos os formulários. */
export function Campo({
  id,
  label,
  erro,
  dica,
  children,
}: {
  id: string;
  label: string;
  erro?: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {erro ? <p className="text-xs text-destructive">{erro}</p> : dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

/** Classe do <select> nativo no mesmo visual do Input. */
export const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
