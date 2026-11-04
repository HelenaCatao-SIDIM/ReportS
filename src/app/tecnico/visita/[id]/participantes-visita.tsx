"use client";

/* eslint-disable @next/next/no-img-element -- imagem da assinatura */
import Link from "next/link";
import { useTransition } from "react";
import { Info, Loader2, PenLine, Plus, Trash2 } from "lucide-react";
import type { PresencaVisita } from "@/lib/types";
import { mascararCpf } from "@/lib/format";
import { retirarPresenca } from "../participantes-actions";
import { SeloParticipante } from "@/components/participante/selo-participante";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Junta os textos preenchidos com " · " (o setor é opcional). */
const juntar = (...partes: string[]) => partes.filter(Boolean).join(" · ");

function LinhaPresenca({ visitaId, p }: { visitaId: string; p: PresencaVisita }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{p.nome}</span>
          <SeloParticipante estado={p.estado} className="shrink-0" />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {juntar(p.cbo?.titulo ?? "", p.setor)}
          {p.cpf && ` · ${mascararCpf(p.cpf)}`}
        </div>
      </div>
      {p.validacao === "login_saude" && <Badge variant="secondary">Login Saúde</Badge>}
      {p.validacao === "sem_login" && <Badge variant="outline" className="border-amber-300 text-amber-800">Sem login</Badge>}
      {p.confirmacao === "assinatura" && p.assinatura ? (
        <img src={p.assinatura} alt={`Assinatura de ${p.nome}`} className="h-9 w-20 shrink-0 rounded border bg-white object-contain" />
      ) : (
        <Badge variant="outline">Nominal</Badge>
      )}
      <button
        type="button"
        aria-label={`Remover ${p.nome}`}
        disabled={pending}
        onClick={() => confirm(`Remover ${p.nome} da lista de presença?`) && start(() => retirarPresenca(visitaId, p.participanteId).then(() => {}))}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </li>
  );
}

/**
 * Lista de presença da visita em andamento, para o técnico conferir (e retirar alguém lançado por engano). Quem assina é na
 * tela de presença, passada aos participantes: aqui só há o atalho para voltar a ela.
 */
export function ParticipantesVisita({
  visitaId,
  presencas,
  exigeAssinatura,
  ehTreinamento,
  semLoginHref,
}: {
  visitaId: string;
  presencas: PresencaVisita[];
  exigeAssinatura: boolean;
  ehTreinamento: boolean;
  /** Só com o login do participante ligado: abre a presença no modo do técnico ("sem login"). */
  semLoginHref?: string | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Participantes ({presencas.length})</h2>
          <Badge variant={exigeAssinatura ? "default" : "secondary"}>
            {exigeAssinatura ? (
              <>
                <PenLine />
                Com assinatura
              </>
            ) : (
              "Nominal"
            )}
          </Badge>
        </div>

        {presencas.length > 0 ? (
          <ul className="divide-y">
            {presencas.map((p) => (
              <LinhaPresenca key={p.participanteId} visitaId={visitaId} p={p} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ninguém registrado ainda.</p>
        )}

        {ehTreinamento && presencas.length === 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <Info className="mt-px size-3.5 shrink-0" />
            Em treinamento, o check-out exige pelo menos um participante.
          </p>
        )}

        <Button nativeButton={false} render={<Link href={`/tecnico/visita/${visitaId}/presenca`} />} variant="outline" className="h-11 w-full">
          <Plus />
          {presencas.length === 0 ? "Abrir a tela de presença" : "Voltar à tela de presença"}
        </Button>
        <p className="text-xs text-muted-foreground">É nela que os participantes buscam o próprio nome e assinam. Chegou mais gente? É só abrir de novo.</p>
        {semLoginHref && (
          <>
            <Button nativeButton={false} render={<Link href={semLoginHref} />} variant="ghost" className="h-10 w-full text-sm">
              Registrar sem login (técnico)
            </Button>
            <p className="text-xs text-muted-foreground">Com o login do Saúde ligado, os participantes entram com o próprio usuário. Para quem não consegue entrar, use este atalho: a presença fica marcada como &ldquo;sem login&rdquo;.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
