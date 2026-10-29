"use client";

/* eslint-disable @next/next/no-img-element -- miniaturas das fotos do storage */
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { VisitaDetalhada } from "@/lib/repo/visitas";
import type { UnidadeComSetores } from "@/lib/repo/clientes";
import type { Tema } from "@/lib/types";
import { paraInputLocal } from "@/lib/datas";
import { TIPOS_VISITA } from "@/lib/visitas";
import { cn } from "@/lib/utils";
import { corrigirVisita, type CorrecaoState } from "../../actions";
import { useAcao } from "@/components/form/use-acao";
import { Campo, selectClass } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CorrecaoForm({ visita: v, unidades, temas }: { visita: VisitaDetalhada; unidades: UnidadeComSetores[]; temas: Tema[] }) {
  const [state, onSubmit, pending] = useAcao<CorrecaoState>(corrigirVisita.bind(null, v.id), {});
  const e = state.erros ?? {};
  const [unidadeId, setUnidadeId] = useState(v.unidadeId);
  const [setor, setSetor] = useState(v.setorId ?? "outro");
  const setores = unidades.find((u) => u.id === unidadeId)?.setores ?? [];

  // Só temas do sistema do contrato da visita, agrupados; inativos só aparecem se já estavam marcados.
  const visiveis = temas.filter((t) => t.sistema === v.sistema && (t.ativo || v.temaIds.includes(t.id)));
  const sistemas = [...new Map(visiveis.map((t) => [t.sistema, t.sistemaNome])).entries()];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {Object.keys(e).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral ?? "Revise os campos destacados."}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados da visita</CardTitle>
          <CardDescription>Horários no horário de Brasília.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo id="entrada" label="Entrada" erro={e.entrada}>
            <Input id="entrada" name="entrada" type="datetime-local" defaultValue={paraInputLocal(v.entrada)} className="h-9" aria-invalid={!!e.entrada} />
          </Campo>
          <Campo id="saida" label="Saída" erro={e.saida}>
            <Input id="saida" name="saida" type="datetime-local" defaultValue={v.saida ? paraInputLocal(v.saida) : ""} className="h-9" aria-invalid={!!e.saida} />
          </Campo>
          <Campo id="tipo" label="Tipo de visita">
            <select id="tipo" name="tipo" defaultValue={v.tipo} className={selectClass}>
              {TIPOS_VISITA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="unidadeId" label="Estabelecimento" erro={e.unidade}>
            <select
              id="unidadeId"
              name="unidadeId"
              value={unidadeId}
              onChange={(ev) => {
                setUnidadeId(ev.target.value);
                setSetor("");
              }}
              className={selectClass}
            >
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="setorId" label="Setor" erro={e.setor}>
            <select id="setorId" name="setorId" value={setor} onChange={(ev) => setSetor(ev.target.value)} className={selectClass} aria-invalid={!!e.setor}>
              <option value="" disabled>
                Escolha…
              </option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
              <option value="outro">Outro…</option>
            </select>
          </Campo>
          {setor === "outro" && (
            <Campo id="setorOutro" label="Nome do setor">
              <Input id="setorOutro" name="setorOutro" defaultValue={v.setorOutro ?? ""} className="h-9" />
            </Campo>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Temas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sistemas.map(([codigo, nome]) => (
            <fieldset key={codigo}>
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{nome}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {visiveis
                  .filter((t) => t.sistema === codigo)
                  .map((t) => (
                    <label key={t.id} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="temaIds" value={t.id} defaultChecked={v.temaIds.includes(t.id)} className="mt-0.5 size-4 accent-primary" />
                      <span>
                        {t.nome}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {t.modulo}
                          {!t.ativo && " (inativo)"}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
          <Campo id="temaAdicional" label="Tema adicional">
            <Input id="temaAdicional" name="temaAdicional" defaultValue={v.temaAdicional} className="h-9" />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Encerramento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Campo id="observacoes" label="Observações">
            <Textarea id="observacoes" name="observacoes" rows={4} defaultValue={v.observacoes} />
          </Campo>
          <Campo id="pendencias" label="Pendências">
            <Textarea id="pendencias" name="pendencias" rows={4} defaultValue={v.pendencias} />
          </Campo>
          <Campo id="proximosPassos" label="Próximos passos">
            <Textarea id="proximosPassos" name="proximosPassos" rows={4} defaultValue={v.proximosPassos} />
          </Campo>
        </CardContent>
      </Card>

      {(v.presencas.length > 0 || v.fotosExtras.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Participantes e fotos</CardTitle>
            <CardDescription>Marque o que deve ser retirado da visita (ex.: participante lançado por engano).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {v.presencas.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {v.presencas.map((p) => (
                  <li key={p.participanteId}>
                    <label className="flex items-center gap-3 px-3 py-2 text-sm has-checked:bg-destructive/5 has-checked:line-through">
                      <input type="checkbox" name="removerPresenca" value={p.participanteId} className="size-4 accent-destructive" />
                      <span className="flex-1">
                        {p.nome}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {p.cbo.titulo} · {p.confirmacao === "assinatura" ? "assinou" : "nominal"}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">remover</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {v.fotosExtras.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {v.fotosExtras.map((f) => (
                  <label key={f.id} className={cn("group relative block cursor-pointer overflow-hidden rounded-lg border")}>
                    <img src={f.url} alt="Foto extra" className="aspect-[4/3] w-full object-cover group-has-checked:opacity-40" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-background/90 px-2 py-1 text-xs">
                      <input type="checkbox" name="removerFoto" value={f.id} className="size-3.5 accent-destructive" />
                      remover
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle>Motivo da correção</CardTitle>
          <CardDescription>Obrigatório. Fica registrado no histórico com o seu nome, a data e o que mudou.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea id="motivo" name="motivo" rows={2} aria-label="Motivo da correção" aria-invalid={!!e.motivo} />
          {e.motivo && <p className="mt-1.5 text-xs text-destructive">{e.motivo}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={`/admin/visitas/${v.id}`} />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Salvar correção
        </Button>
      </div>
    </form>
  );
}
