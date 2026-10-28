import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { buscarVisita } from "@/lib/repo/visitas";
import { ehPresencial, rotuloTipo } from "@/lib/visitas";
import { exigeParticipantes } from "@/lib/regras-visita";
import { localizacaoPorCep } from "@/lib/config";
import { CheckoutForm } from "./checkout-form";

export default function CheckoutPage({ params }: PageProps<"/tecnico/visita/[id]/checkout">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/tecnico/visita/[id]/checkout">, "params">) {
  const [{ id }, usuario] = await Promise.all([params, getUsuarioAtual()]);
  const v = await buscarVisita(id);
  if (!v || !usuario || v.tecnicoId !== usuario.id) notFound();
  if (v.status !== "em_andamento") redirect(`/tecnico/visita/${id}`);

  return (
    <div className="space-y-4">
      <Link href={`/tecnico/visita/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Visita
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Check-out</h1>
        <p className="text-sm text-muted-foreground">Confira a visita e registre o que foi feito.</p>
      </div>
      <CheckoutForm
        visitaId={id}
        entrada={v.entrada}
        presencial={ehPresencial(v.tipo)}
        faltaParticipantes={exigeParticipantes(v.tipo) && v.presencas.length === 0}
        porCep={localizacaoPorCep()}
        resumo={{
          clienteNome: v.clienteNome,
          local: `${v.unidadeNome} · ${v.setorNome}`,
          tipo: rotuloTipo(v.tipo),
          temas: v.temas.length + (v.temaAdicional ? 1 : 0),
          fotos: v.fotosExtras.length,
          participantes: v.presencas.length,
        }}
      />
    </div>
  );
}
