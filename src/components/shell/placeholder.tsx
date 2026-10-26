import { Construction } from "lucide-react";

/** Cabeçalho padrão das páginas internas. */
export function PageHeader({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
    </div>
  );
}

/** Placeholder de feature ainda não implementada. */
export function Placeholder({ titulo, descricao, itens }: { titulo: string; descricao: string; itens: string[] }) {
  return (
    <>
      <PageHeader titulo={titulo} descricao={descricao} />
      <div className="rounded-xl border border-dashed bg-muted/30 p-8">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Construction className="size-4" />
          Em construção: o que esta tela vai ter
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
          {itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
