"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { salvarConexao, type ConexaoN8nState } from "./actions";
import { Campo } from "@/components/form/campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Conexão com o n8n que traz os chamados do suporte (Fortics) para o relatório: só o endereço do webhook. */
export function ConexaoN8nForm({ url }: { url: string }) {
  const [state, action, pending] = useActionState<ConexaoN8nState, FormData>(salvarConexao, {});
  const e = state.erros ?? {};
  const guardado = !!url || !!state.salvo;

  return (
    <form action={action} className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Chamados de suporte (n8n)</CardTitle>
          <CardDescription>
            Os chamados do Fortics entram em todos os relatórios, vindos do fluxo “Reports Sidim - Resumo de chamados por cliente” do n8n. Informe o endereço do
            webhook de produção desse fluxo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Campo id="url" label="Endereço do webhook" erro={e.url} dica="Exemplo: https://seu-n8n/webhook/resumo-chamados-cliente (o de produção, não o de teste). Quem souber este endereço consulta os chamados: não o divulgue.">
            <Input id="url" name="url" type="url" defaultValue={state.url ?? url} placeholder="https://" autoComplete="off" aria-invalid={!!e.url} />
          </Campo>

          {state.teste && (
            <Alert className={state.teste.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-destructive/40 bg-destructive/5 text-destructive"}>
              {state.teste.ok ? <CheckCircle2 /> : <AlertCircle />}
              <AlertDescription className={state.teste.ok ? "text-emerald-800" : "text-destructive"}>
                {state.salvo && "Salvo. "}
                {state.teste.texto}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {guardado && (
              <Button type="submit" name="acao" value="testar" variant="outline" disabled={pending}>
                Testar de novo
              </Button>
            )}
            <Button type="submit" name="acao" value="salvar" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Salvar e testar
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
