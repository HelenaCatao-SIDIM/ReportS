"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import type { AprovadorForm, ClienteFormState } from "./actions";
import type { Cliente, NivelComprovacao } from "@/lib/types";
import { formatarCnpj } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Acao = (state: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;

const NIVEIS: { valor: NivelComprovacao; titulo: string; descricao: string }[] = [
  { valor: "nominal", titulo: "Nominal", descricao: "Basta a lista de participantes com nome, cargo, CBO e setor." },
  { valor: "assinado", titulo: "Assinado", descricao: "Cada participante assina com o dedo na tela do celular do técnico." },
];

const vazio = (): AprovadorForm => ({ nome: "", cargo: "", email: "" });

/** Bloco de aprovadores: linhas editáveis, enviadas ao servidor como JSON. */
function Aprovadores({ inicial, erro, errosLinha }: { inicial: AprovadorForm[]; erro?: string; errosLinha: Record<number, string> }) {
  const [linhas, setLinhas] = useState<AprovadorForm[]>(inicial.length ? inicial : [vazio()]);
  const alterar = (i: number, campo: keyof AprovadorForm, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="aprovadores" value={JSON.stringify(linhas)} />
      <div className="hidden grid-cols-[1fr_1fr_1.2fr_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
        <span>Nome</span>
        <span>Cargo</span>
        <span>E-mail</span>
      </div>
      {linhas.map((l, i) => (
        <div key={i} className="space-y-1">
          <div className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1.2fr_2rem] sm:border-0 sm:p-0">
            <Input aria-label="Nome do aprovador" placeholder="Nome" value={l.nome} onChange={(e) => alterar(i, "nome", e.target.value)} className="h-9" />
            <Input aria-label="Cargo do aprovador" placeholder="Cargo" value={l.cargo} onChange={(e) => alterar(i, "cargo", e.target.value)} className="h-9" />
            <Input aria-label="E-mail do aprovador" type="email" placeholder="email@cliente.com.br" value={l.email} onChange={(e) => alterar(i, "email", e.target.value)} className="h-9" aria-invalid={!!errosLinha[i]} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover aprovador"
              onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [vazio()]))}
              className="justify-self-end"
            >
              <Trash2 />
            </Button>
          </div>
          {errosLinha[i] && <p className="px-1 text-xs text-destructive">{errosLinha[i]}</p>}
        </div>
      ))}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <Button type="button" variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, vazio()])}>
        <Plus />
        Adicionar aprovador
      </Button>
    </div>
  );
}

export function ClienteForm({ acao, cliente }: { acao: Acao; cliente?: Cliente }) {
  const [state, action, pending] = useActionState(acao, {});
  const v = state.valores ?? cliente;
  const e = state.erros ?? {};
  const edicao = !!cliente;
  const [cnpj, setCnpj] = useState(formatarCnpj(v?.cnpj ?? ""));
  const [nivel, setNivel] = useState<NivelComprovacao>(v?.nivel ?? "nominal");

  return (
    <form action={action} noValidate className="space-y-6">
      {Object.keys(e).length + Object.keys(state.errosAprovadores ?? {}).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Revise os campos destacados.</AlertDescription>
        </Alert>
      )}

      <Card key={`dados-${JSON.stringify(state.valores ?? null)}`}>
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Campo id="nome" label="Nome" erro={e.nome}>
            <Input id="nome" name="nome" defaultValue={v?.nome} aria-invalid={!!e.nome} className="h-9" />
          </Campo>
          <Campo id="cnpj" label="CNPJ" erro={e.cnpj}>
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
          <div className="sm:col-span-2">
            <Campo id="contrato" label="Contrato" erro={e.contrato} dica="Aparece na capa do relatório enviado ao cliente.">
              <Textarea id="contrato" name="contrato" rows={2} defaultValue={v?.contrato} aria-invalid={!!e.contrato} />
            </Campo>
          </div>
          {edicao && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={v?.ativo} className="size-4 accent-primary" />
              Cliente ativo
              <span className="text-muted-foreground">(inativo não aparece para o técnico no check-in)</span>
            </label>
          )}
        </CardContent>
      </Card>

      <Card key={`comprovacao-${JSON.stringify(state.valores ?? null)}`}>
        <CardHeader>
          <CardTitle>Comprovação de presença</CardTitle>
          <CardDescription>Como este cliente exige a lista de participantes dos treinamentos.</CardDescription>
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
                <input
                  type="radio"
                  name="nivel"
                  value={n.valor}
                  checked={nivel === n.valor}
                  onChange={() => setNivel(n.valor)}
                  className="mt-0.5 size-4 accent-primary"
                />
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

      <Card key={`fortics-${JSON.stringify(state.valores ?? null)}`}>
        <CardHeader>
          <CardTitle>Chamados de suporte</CardTitle>
          <CardDescription>Liga este cliente aos atendimentos do Fortics, para o relatório mostrar os chamados abertos e fechados no período.</CardDescription>
        </CardHeader>
        <CardContent>
          <Campo
            id="nomesFortics"
            label="Nome no Fortics"
            erro={e.nomesFortics}
            dica="Como este cliente aparece no Fortics, no campo Cliente / Município (ex.: Prefeitura de Vale Verde / Vale Verde). Um por linha; pode ter mais de um."
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

      <Card>
        <CardHeader>
          <CardTitle>Aprovadores</CardTitle>
          <CardDescription>
            Pessoas do cliente que recebem o relatório por e-mail e aprovam pelo link, sem senha. Basta um deles aprovar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Aprovadores
            key={JSON.stringify(state.valores?.aprovadores ?? null)}
            inicial={v?.aprovadores ?? []}
            erro={e.aprovadores}
            errosLinha={state.errosAprovadores ?? {}}
          />
        </CardContent>
      </Card>

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
