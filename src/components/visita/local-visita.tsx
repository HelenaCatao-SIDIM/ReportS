import { MapPin } from "lucide-react";
import { formatarCep, textoEndereco } from "@/lib/format";
import type { LocalVisita as Local } from "@/lib/types";

/**
 * Local do check-in/check-out mostrado como CEP + endereço. Nunca imprime latitude/longitude.
 * `compacto`: uma linha só (cabeçalho da visita no App do Técnico).
 */
export function LocalVisita({ local, compacto = false }: { local: Local | null; compacto?: boolean }) {
  if (!local) return <span className="text-muted-foreground">—</span>;

  const e = local.endereco;
  const precisao = local.precisaoM != null ? `±${local.precisaoM} m` : null;
  const endereco = e ? textoEndereco(e) : "";

  let principal: string;
  if (!e) principal = "Localização registrada";
  else if (e.status === "ok" && e.cep) principal = `CEP ${formatarCep(e.cep)}`;
  else if (e.status === "sem_cep") principal = "CEP não identificado";
  else if (e.status === "pendente") principal = "Identificando o CEP…";
  else principal = "Endereço indisponível no momento";

  const temCep = e?.status === "ok" && !!e.cep;

  if (compacto) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <MapPin className="size-3 shrink-0" />
        <span className="truncate">
          {principal}
          {temCep && e?.cidade ? ` · ${[e.cidade, e.uf].filter(Boolean).join("/")}` : ""}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1">
      <MapPin className="mt-0.5 size-3 shrink-0" />
      <span className="min-w-0">
        <span className={temCep ? "font-medium" : "text-muted-foreground"}>{principal}</span>
        {temCep && e?.aproximado && <span className="ml-1 text-xs text-muted-foreground">(aproximado)</span>}
        {endereco && e?.status !== "pendente" && <span className="block text-xs text-muted-foreground">{endereco}</span>}
        {precisao && <span className="block text-xs text-muted-foreground">Precisão do GPS: {precisao}</span>}
        {e?.fonte === "nominatim" && (e.status === "ok" || e.status === "sem_cep") && (
          <span className="block text-[10px] text-muted-foreground/80">Endereço: © colaboradores do OpenStreetMap</span>
        )}
      </span>
    </span>
  );
}
