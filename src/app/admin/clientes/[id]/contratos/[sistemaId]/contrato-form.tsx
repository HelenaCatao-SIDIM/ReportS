"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import type { ContratoFormState, NovoAprovadorForm } from "../../../contrato-actions";
import type { Aprovador, NivelComprovacao } from "@/lib/types";
import { NIVEIS } from "@/lib/contratos";
import { cn } from "@/lib/utils";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Acao = (state: ContratoFormState, formData: FormData) => Promise<ContratoFormState>;

interface ValoresContrato {
  texto: string;
  nivel: NivelComprovacao;
  exigeCpf: boolean;
  ativo: boolean;
  aprovadorIds: string[];
}

const vazio = (): NovoAprovadorForm => ({ nome: "", cargo: "", email: "" });

/** Aprovadores novos: linhas editáveis, enviadas ao servidor como JSON. */
function NovosAprovadores({ inicial, errosLinha }: { inicial: NovoAprovadorForm[]; errosLinha: Record<number, string> }) {
  const [linhas, setLinhas] = useState<NovoAprovadorForm[]>(inicial);
  const alterar = (i: number, campo: keyof NovoAprovadorForm, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="novos" value={JSON.stringify(linhas)} />
      {linhas.map((l, i) => (
        <div key={i} className="space-y-1">
          <div className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1.2fr_2rem] sm:border-0 sm:p-0">
            <Input aria-label="Nome do aprovador" placeholder="Nome" value={l.nome} onChange={(e) => alterar(i, "nome", e.target.value)} className="h-9" />
            <Input aria-label="Cargo do aprovador" placeholder="Cargo" value={l.cargo} onChange={(e) => alterar(i, "cargo", e.target.value)} className="h-9" />
            <Input
              aria-label="E-mail do aprovador"
              type="email"
              placeholder="email@cliente.com.br"
              value={l.email}
              onChange={(e) => alterar(i, "email", e.target.value)}
              className="h-9"
              aria-invalid={!!errosLinha[i]}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover aprovador novo"
              onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
              className="justify-self-end"
            >
              <Trash2 />
            </Button>
          </div>
          {errosLinha[i] && <p className="px-1 text-xs text-destructive">{errosLinha[i]}</p>}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, vazio()])}>
        <Plus />
        Cadastrar aprovador novo
      </Button>
    </div>
  );
}

export function ContratoForm({
  acao,
  clienteId,
  contrato,
  aprovadores,
}: {
  acao: Acao;
  clienteId: string;
  contrato?: ValoresContrato;
  aprovadores: Aprovador[];
}) {
  const [state, action, pending] = useActionState(acao, {});
  const v: ValoresContrato | undefined = state.valores ?? contrato;
  const e = state.erros ?? {};
  const edicao = !!contrato;
  const [nivel, setNivel] = useState<NivelComprovacao>(v?.nivel ?? "nominal");
  const marcados = v?.aprovadorIds ?? [];
  const chave = JSON.stringify(state.valores ?? null);

  return (
    <form action={action} noValidate className="space-y-6">
      {(Object.keys(e).length > 0 || Object.keys(state.errosNovos ?? {}).length > 0) && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral ?? "Revise os campos destacados."}</AlertDescription>
        </Alert>
      )}

      <Card key={`contrato-${chave}`}>
        <CardHeader>
          <CardTitle>Contrato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Campo id="texto" label="Texto do contrato" erro={e.texto} dica="Aparece na capa do relatório enviado ao cliente.">
            <Textarea id="texto" name="texto" rows={2} defaultValue={v?.texto} aria-invalid={!!e.texto} />
          </Campo>
          {edicao && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={v?.ativo} className="size-4 accent-primary" />
              Contrato ativo
              <span className="text-muted-foreground">(inativo não aparece para o técnico no check-in)</span>
            </label>
          )}
        </CardContent>
      </Card>

      <Card key={`comprovacao-${chave}`}>
        <CardHeader>
          <CardTitle>Comprovação de presença</CardTitle>
          <CardDescription>Como este contrato exige a lista de participantes dos treinamentos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {NIVEIS.map((n) => (
              <label
                key={n.valor}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                  nivel === n.valor ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input type="radio" name="nivel" value={n.valor} checked={nivel === n.valor} onChange={() => setNivel(n.valor)} className="mt-0.5 size-4 accent-primary" />
                <span>
                  <span className="block text-sm font-medium">{n.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{n.descricao}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="exigeCpf" defaultChecked={v?.exigeCpf} className="mt-0.5 size-4 accent-primary" />
            <span>
              Exige CPF dos participantes
              <span className="block text-xs text-muted-foreground">
                O campo de CPF só aparece para o técnico quando marcado. No relatório, o CPF sai sempre mascarado.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card key={`aprovadores-${chave}`}>
        <CardHeader>
          <CardTitle>Aprovadores</CardTitle>
          <CardDescription>
            Quem recebe o relatório deste contrato por e-mail e aprova pelo link, sem senha. Basta um deles aprovar. A mesma pessoa pode aprovar para vários contratos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aprovadores.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {aprovadores.map((a) => (
                <label key={a.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50">
                  <input type="checkbox" name="aprovadorIds" value={a.id} defaultChecked={marcados.includes(a.id)} className="mt-0.5 size-4 accent-primary" />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {a.nome}
                      {!a.ativo && <span className="text-xs font-normal text-muted-foreground"> (inativo)</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.cargo ? `${a.cargo} · ` : ""}
                      {a.email}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum aprovador cadastrado ainda. Cadastre o primeiro abaixo.</p>
          )}
          <div className="border-t pt-4">
            <p className="mb-2 text-xs text-muted-foreground">Pessoa que ainda não está na lista:</p>
            <NovosAprovadores key={chave} inicial={state.valores?.novos ?? []} errosLinha={state.errosNovos ?? {}} />
          </div>
          {e.aprovadores && <p className="text-xs text-destructive">{e.aprovadores}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={`/admin/clientes/${clienteId}`} />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {edicao ? "Salvar contrato" : "Criar contrato"}
        </Button>
      </div>
    </form>
  );
}
