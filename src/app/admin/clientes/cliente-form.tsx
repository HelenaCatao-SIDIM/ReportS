"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ClienteFormState } from "./actions";
import type { Cliente, EstadoSistemaCliente, Sistema } from "@/lib/types";
import { ROTULO_ESTADO } from "@/lib/contratos";
import { formatarCnpj } from "@/lib/format";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Acao = (state: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;

interface Props {
  acao: Acao;
  cliente?: Cliente;
  chamadosAtivos?: boolean;
  /** Sistemas que o cliente ainda não tem (na criação, todos os ativos). */
  sistemasDisponiveis: Sistema[];
  /** Só na edição: sistemas que o cliente já tem. */
  sistemasAtuais?: { id: string; sistemaNome: string; estado: EstadoSistemaCliente; tenantId: string | null }[];
}

export function ClienteForm({ acao, cliente, chamadosAtivos = false, sistemasDisponiveis, sistemasAtuais = [] }: Props) {
  const [state, action, pending] = useActionState(acao, {});
  const v = state.valores ?? cliente;
  const e = state.erros ?? {};
  const edicao = !!cliente;
  const [cnpj, setCnpj] = useState(formatarCnpj(v?.cnpj ?? ""));
  const escolhidos = state.valores?.sistemas ?? [];

  return (
    <form action={action} noValidate className="space-y-6">
      {Object.keys(e).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Revise os campos destacados.</AlertDescription>
        </Alert>
      )}

      <Card key={`dados-${JSON.stringify(state.valores ?? null)}`}>
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
          <CardDescription>Um cadastro por cliente, identificado pelo CNPJ. O contrato, a comprovação e os aprovadores ficam em cada sistema.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="nome"
            label="Nome"
            erro={e.nome}
            dica={cliente?.nomeDoClickUp ? "Cliente vinculado ao ClickUp: o nome é o da opção no ClickUp e muda por lá." : undefined}
          >
            <Input id="nome" name="nome" defaultValue={v?.nome} readOnly={cliente?.nomeDoClickUp} aria-invalid={!!e.nome} className="h-9" />
          </Campo>
          <Campo
            id="cnpj"
            label="CNPJ"
            erro={e.cnpj}
            dica={cliente?.origem === "sinc" ? "Cliente que veio do SINC: pode ficar pendente, mas é exigido para emitir relatório." : undefined}
          >
            <Input
              id="cnpj"
              name="cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(ev) => setCnpj(formatarCnpj(ev.target.value))}
              aria-invalid={!!e.cnpj}
              className="h-9"
            />
          </Campo>
          {edicao && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={cliente?.ativo} className="size-4 accent-primary" />
              Cliente ativo
              <span className="text-muted-foreground">(inativo não aparece para o técnico no check-in)</span>
            </label>
          )}
        </CardContent>
      </Card>

      <Card key={`sistemas-${JSON.stringify(state.valores ?? null)}`}>
        <CardHeader>
          <CardTitle>Sistemas do cliente</CardTitle>
          <CardDescription>
            {edicao
              ? "Os sistemas que o cliente usa. O vínculo com o tenant é feito no SINC; aqui o sistema entra “em implantação”."
              : "Escolha os sistemas que o cliente vai usar. Cada um entra “em implantação” e ganha o seu contrato na tela do cliente."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sistemasAtuais.length > 0 && (
            <ul className="space-y-1.5">
              {sistemasAtuais.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{x.sistemaNome}</span>
                  <Badge variant={x.estado === "vinculado" ? "default" : "secondary"}>{ROTULO_ESTADO[x.estado]}</Badge>
                  {x.tenantId && <span className="text-xs text-muted-foreground">tenant {x.tenantId}</span>}
                </li>
              ))}
            </ul>
          )}
          {sistemasDisponiveis.length > 0 ? (
            <div className={sistemasAtuais.length ? "border-t pt-3" : ""}>
              {edicao && <p className="mb-2 text-xs text-muted-foreground">Acrescentar sistema:</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {sistemasDisponiveis.map((s) => (
                  <label key={s.codigo} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50">
                    <input type="checkbox" name="sistemas" value={s.codigo} defaultChecked={escolhidos.includes(s.codigo)} className="size-4 accent-primary" />
                    {s.nome}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            edicao && <p className="text-xs text-muted-foreground">O cliente já tem todos os sistemas cadastrados.</p>
          )}
          {e.sistemas && <p className="text-xs text-destructive">{e.sistemas}</p>}
        </CardContent>
      </Card>

      {chamadosAtivos && (
        <Card key={`sinc-${JSON.stringify(state.valores ?? null)}`}>
          <CardHeader>
            <CardTitle>Chamados de suporte</CardTitle>
            <CardDescription>Liga este cliente aos atendimentos do suporte, para o relatório mostrar os chamados abertos e fechados no período.</CardDescription>
          </CardHeader>
          <CardContent>
            <Campo
              id="nomesFortics"
              label="Nome no SINC"
              erro={e.nomesFortics}
              dica="O nome do cliente no SINC, o mesmo que aparece no campo Cliente / Município dos atendimentos (ex.: Prefeitura de Vale Verde / Vale Verde). Um por linha; pode ter mais de um."
            >
              <Textarea
                id="nomesFortics"
                name="nomesFortics"
                rows={3}
                defaultValue={(v?.nomesFortics ?? []).join("\n")}
                aria-invalid={!!e.nomesFortics}
              />
            </Campo>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={edicao ? `/admin/clientes/${cliente.id}` : "/admin/clientes"} />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {edicao ? "Salvar alterações" : "Criar cliente"}
        </Button>
      </div>
    </form>
  );
}
