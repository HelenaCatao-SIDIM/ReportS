import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Timer } from "lucide-react";
import { getUsuarioAtual } from "@/lib/dal";
import { listarParaCheckin } from "@/lib/repo/contratos";
import { listarPendentesDosContratos } from "@/lib/repo/cronograma";
import { horaDoServidor } from "@/lib/agora";
import { visitaAbertaDoTecnico } from "@/lib/repo/visitas";
import { dataLocal, formatarDataHora } from "@/lib/datas";
import { rotuloAtendidos, rotuloTipo } from "@/lib/visitas";
import { equipesDaVisita, rotaDaVisita } from "@/lib/regras-visita";
import { listarEquipes } from "@/lib/repo/equipes";
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
                {aberta.unidadeNome} · {rotuloAtendidos(aberta)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {rotuloTipo(aberta.tipo)} · entrada {formatarDataHora(aberta.entrada)}
              </div>
            </div>
            <Button nativeButton={false} render={<Link href={rotaDaVisita(aberta)} />} className="h-11 w-full text-base">
              Continuar visita
              <ArrowRight />
            </Button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Você só pode ter uma visita aberta. Faça o check-out antes de iniciar outra.</p>
      </div>
    );
  }

  const [clientes, todasEquipes] = await Promise.all([listarParaCheckin(), listarEquipes()]);
  // Equipes que o técnico pode marcar no check-in (as mesmas que a visita aceita depois).
  const equipes = equipesDaVisita(todasEquipes, []).map(({ id, nome }) => ({ id, nome }));
  // O que ainda falta do cronograma de implantação nos estabelecimentos desses contratos (sem a observação interna).
  const hoje = dataLocal(await horaDoServidor());
  const cronograma = (await listarPendentesDosContratos(clientes.flatMap((c) => c.contratos.map((x) => x.id)), hoje)).map((i) => ({
    contratoId: i.contratoId,
    unidadeId: i.unidadeId,
    equipeNomes: i.equipeNomes,
    tipo: i.tipo,
    prazo: i.prazo,
    situacao: i.situacao,
    diasParaPrazo: i.diasParaPrazo,
  }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Novo check-in</h1>
        <p className="text-sm text-muted-foreground">Registre a chegada ao cliente.</p>
      </div>
      <CheckinForm clientes={clientes} equipes={equipes} cronograma={cronograma} porCep={localizacaoPorCep()} carimbo={carimboFoto()} />
    </div>
  );
}
