import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Timer } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { listarParaCheckin } from "@/lib/repo/contratos";
import { visitaAbertaDoTecnico } from "@/lib/repo/visitas";
import { formatarDataHora } from "@/lib/datas";
import { rotuloTipo } from "@/lib/visitas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { carimboFoto, localizacaoPorCep } from "@/lib/config";
import { CheckinForm } from "./checkin-form";

export default function TecnicoHome() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const aberta = await visitaAbertaDoTecnico(usuario.id);

  if (aberta) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Olá, {usuario.nome.split(" ")[0]}</h1>
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Timer className="size-4" />
              Visita em andamento
            </div>
            <div>
              <div className="text-lg font-semibold">
                {aberta.clienteNome}
                <span className="font-normal text-muted-foreground"> · {aberta.sistemaNome}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {aberta.unidadeNome} · {aberta.setorNome}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {rotuloTipo(aberta.tipo)} · entrada {formatarDataHora(aberta.entrada)}
              </div>
            </div>
            <Button nativeButton={false} render={<Link href={`/tecnico/visita/${aberta.id}`} />} className="h-11 w-full text-base">
              Continuar visita
              <ArrowRight />
            </Button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Você só pode ter uma visita aberta. Faça o check-out antes de iniciar outra.</p>
      </div>
    );
  }

  const clientes = await listarParaCheckin();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Novo check-in</h1>
        <p className="text-sm text-muted-foreground">Registre a chegada ao cliente.</p>
      </div>
      <CheckinForm clientes={clientes} porCep={localizacaoPorCep()} carimbo={carimboFoto()} />
    </div>
  );
}
