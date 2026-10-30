"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { criarRelatorio, type NovoRelatorioState } from "../actions";
import { useAcao } from "@/components/form/use-acao";
import { Campo, selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type Periodo = { de: string; ate: string };

export function NovoRelatorioForm({
  clientes,
  mesPassado,
  mesAtual,
}: {
  clientes: { id: string; nome: string; contratos: { id: string; sistemaNome: string }[] }[];
  mesPassado: Periodo;
  mesAtual: Periodo;
}) {
  const [state, onSubmit, pending] = useAcao<NovoRelatorioState>(criarRelatorio, {});
  const e = state.erros ?? {};
  const [periodo, setPeriodo] = useState<Periodo>(mesPassado);
  const [clienteId, setClienteId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const cliente = clientes.find((c) => c.id === clienteId);

  return (
    <Card className="max-w-xl">
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {e.geral && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{e.geral}</AlertDescription>
            </Alert>
          )}
          <Campo id="clienteId" label="Cliente" erro={e.cliente}>
            <select
              id="clienteId"
              name="clienteId"
              value={clienteId}
              onChange={(ev) => {
                setClienteId(ev.target.value);
                const c = clientes.find((x) => x.id === ev.target.value);
                // Cliente com um só sistema já vem com o contrato escolhido.
                setContratoId(c?.contratos.length === 1 ? c.contratos[0].id : "");
              }}
              className={selectClass}
              aria-invalid={!!e.cliente}
            >
              <option value="" disabled>
                Escolha o cliente
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="contratoId" label="Sistema (contrato)" erro={e.contrato}>
            <select
              id="contratoId"
              name="contratoId"
              value={contratoId}
              disabled={!cliente}
              onChange={(ev) => setContratoId(ev.target.value)}
              className={selectClass}
              aria-invalid={!!e.contrato}
            >
              <option value="" disabled>
                {cliente ? "Escolha o sistema" : "Escolha o cliente primeiro"}
              </option>
              {cliente?.contratos.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.sistemaNome}
                </option>
              ))}
            </select>
          </Campo>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Período</span>
              <Button type="button" variant="outline" size="xs" onClick={() => setPeriodo(mesPassado)}>
                Mês passado
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={() => setPeriodo(mesAtual)}>
                Este mês
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo id="de" label="De" erro={e.de}>
                <Input id="de" name="de" type="date" value={periodo.de} onChange={(ev) => setPeriodo((p) => ({ ...p, de: ev.target.value }))} className="h-9" />
              </Campo>
              <Campo id="ate" label="Até" erro={e.ate}>
                <Input id="ate" name="ate" type="date" value={periodo.ate} onChange={(ev) => setPeriodo((p) => ({ ...p, ate: ev.target.value }))} className="h-9" />
              </Campo>
            </div>
          </div>
          <ul className="list-disc space-y-1 rounded-lg bg-muted/50 p-3 pl-7 text-xs text-muted-foreground">
            <li>Entram automaticamente todas as visitas encerradas do cliente neste sistema (contrato) no período.</li>
            <li>Visitas encerradas de períodos anteriores que ficaram fora de relatório também entram, sinalizadas.</li>
            <li>Visitas em andamento ficam de fora e entram no relatório seguinte.</li>
            <li>O relatório nasce como rascunho; nada é enviado ao cliente nesta etapa.</li>
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/relatorios" />}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Gerar rascunho
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
