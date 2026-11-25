import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { buscarVisita } from "@/lib/repo/visitas";
import { ehPresencial, rotuloTipo } from "@/lib/visitas";
import { formatarDataHora } from "@/lib/datas";
import { localizacaoPorCep } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { EntrarForm } from "./entrar-form";

export default function EntrarPage({ params }: PageProps<"/tecnico/visita/[id]/entrar">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: Pick<PageProps<"/tecnico/visita/[id]/entrar">, "params">) {
  const [{ id }, usuario] = await Promise.all([params, getUsuarioAtual()]);
  const v = await buscarVisita(id);
  if (!v || !usuario) notFound();
  // Só com um convite pendente para esta visita.
  const convite = v.tecnicos?.find((t) => t.tecnicoId === usuario.id);
  if (!convite || convite.papel !== "convidado") notFound();
  if (v.status !== "em_andamento") redirect(`/tecnico/visita/${id}`);
  // Já entrou: vai direto para a visita.
  if (convite.estado !== "convidado") redirect(`/tecnico/visita/${id}`);

  return (
    <div className="space-y-4">
      <Link href="/tecnico" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Início
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Entrar na visita</h1>
        <p className="text-sm text-muted-foreground">Registre a sua chegada para entrar na visita conjunta.</p>
      </div>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Users className="size-4" />
            Visita conjunta
          </div>
          <div className="text-base font-semibold">
            {v.clienteNome}
            <span className="font-normal text-muted-foreground"> · {v.sistemaNome}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {v.unidadeNome} · {rotuloTipo(v.tipo)}
          </div>
          <div className="text-xs text-muted-foreground">Aberta por {v.tecnicoNome} às {formatarDataHora(v.entrada)}</div>
        </CardContent>
      </Card>
      <EntrarForm visitaId={id} presencial={ehPresencial(v.tipo)} porCep={localizacaoPorCep()} />
    </div>
  );
}
