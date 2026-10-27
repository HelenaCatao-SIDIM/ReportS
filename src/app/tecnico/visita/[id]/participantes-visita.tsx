"use client";

/* eslint-disable @next/next/no-img-element -- imagem da assinatura */
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, Info, Loader2, PenLine, Plus, Search, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import type { Cbo, PresencaVisita } from "@/lib/types";
import { formatarCbo, formatarCpf, mascararCpf } from "@/lib/format";
import { chaveRascunhoParticipante } from "@/lib/regras-visita";
import { registrarPresenca, retirarPresenca, sugerirParticipantes, type PresencaState, type SugestaoParticipante } from "../participantes-actions";
import { useAcao } from "@/components/form/use-acao";
import { CboCampo } from "@/components/form/cbo-campo";
import { AssinaturaCampo } from "@/components/tecnico/assinatura-campo";
import { apagarRascunho, guardarRascunho, lerRascunho } from "@/components/tecnico/rascunho";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Config {
  visitaId: string;
  clienteNome: string;
  exigeAssinatura: boolean;
  exigeCpf: boolean;
  setores: string[];
  /** Setor da visita; já vem preenchido no cadastro de novo participante. */
  setorVisita: string;
}

function AvisoLgpd({ clienteNome, exigeCpf, exigeAssinatura }: Pick<Config, "clienteNome" | "exigeCpf" | "exigeAssinatura">) {
  const dados = ["nome", "ocupação (CBO)", "setor", ...(exigeCpf ? ["CPF"] : []), ...(exigeAssinatura ? ["assinatura"] : [])];
  return (
    <div className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <p>
        Os dados coletados ({dados.join(", ")}) servem apenas para comprovar a participação neste atendimento e compor o relatório enviado a{" "}
        {clienteNome}.{exigeCpf && " O CPF aparece mascarado no relatório."}
      </p>
    </div>
  );
}

const Erro = ({ msg }: { msg?: string }) => (msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null);

/** O que o técnico já tinha digitado no cadastro de novo participante. */
interface RascunhoParticipante {
  nome: string;
  cbo: Cbo | null;
  setor: string;
  cpf: string;
}

/** Junta os textos preenchidos com " · " (o setor é opcional). */
const juntar = (...partes: string[]) => partes.filter(Boolean).join(" · ");

function AdicionarForm({ visitaId, clienteNome, exigeAssinatura, exigeCpf, setores, setorVisita, onFeito }: Config & { onFeito: () => void }) {
  const [state, onSubmit, pending] = useAcao<PresencaState>(registrarPresenca.bind(null, visitaId), {});
  const e = state.erros ?? {};
  // Este formulário só existe depois que o técnico abre a janela (nunca no servidor), então ler o aparelho aqui é seguro.
  const chaveRascunho = chaveRascunhoParticipante(visitaId);
  const [rascunho] = useState(() => lerRascunho<RascunhoParticipante>(chaveRascunho));
  const [recuperado, setRecuperado] = useState(!!rascunho);
  const [modo, setModo] = useState<"busca" | "existente" | "novo">(rascunho ? "novo" : "busca");
  const [nome, setNome] = useState(rascunho?.nome ?? "");
  const [cbo, setCbo] = useState<Cbo | null>(rascunho?.cbo ?? null);
  const [setor, setSetor] = useState(rascunho?.setor ?? setorVisita);
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState<SugestaoParticipante[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<SugestaoParticipante | null>(null);
  const [cpf, setCpf] = useState(rascunho?.cpf ?? "");
  const [assinado, setAssinado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  useEffect(() => {
    if (state.ok) {
      apagarRascunho(chaveRascunho);
      onFeito();
    }
  }, [state, onFeito, chaveRascunho]);

  // Guarda o que está sendo digitado a cada mudança, até a presença ser confirmada.
  useEffect(() => {
    if (modo === "novo") guardarRascunho(chaveRascunho, { nome, cbo, setor, cpf } satisfies RascunhoParticipante);
  }, [modo, nome, cbo, setor, cpf, chaveRascunho]);

  function buscar(novo: string) {
    setTermo(novo);
    clearTimeout(timer.current);
    const n = ++seq.current;
    if (novo.trim().length < 2) {
      setSugestoes([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const r = await sugerirParticipantes(visitaId, novo);
      if (n !== seq.current) return;
      setSugestoes(r);
      setBuscando(false);
    }, 250);
  }

  const podeConfirmar = modo !== "busca" && (!exigeAssinatura || assinado);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <AvisoLgpd clienteNome={clienteNome} exigeCpf={exigeCpf} exigeAssinatura={exigeAssinatura} />
      {e.geral && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{e.geral}</AlertDescription>
        </Alert>
      )}

      {modo === "busca" && (
        <div className="space-y-2">
          <Label htmlFor="busca-participante">Nome do participante</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busca-participante"
              value={termo}
              onChange={(ev) => buscar(ev.target.value)}
              placeholder="Comece a digitar o nome"
              autoComplete="off"
              autoFocus
              className="h-11 pl-9 text-base"
            />
            {buscando && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          {termo.trim().length >= 2 && !buscando && (
            <ul className="divide-y rounded-lg border">
              {sugestoes.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEscolhido(s);
                      setModo("existente");
                    }}
                    className="w-full px-3 py-2.5 text-left"
                  >
                    <span className="block text-sm font-medium">{s.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {juntar(s.cbo.titulo, s.setor)}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setNome(termo.trim());
                    setCbo(null);
                    setSetor(setorVisita);
                    setCpf("");
                    setModo("novo");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-primary"
                >
                  <UserPlus className="size-4" />
                  Cadastrar novo participante: “{termo.trim()}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      {modo === "existente" && escolhido && (
        <div className="rounded-lg border p-3">
          <input type="hidden" name="participanteId" value={escolhido.id} />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-sm">
              <div className="font-medium">{escolhido.nome}</div>
              {escolhido.setor && <div className="text-muted-foreground">{escolhido.setor}</div>}
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{formatarCbo(escolhido.cbo.codigo)}</span> {escolhido.cbo.titulo}
              </div>
              {escolhido.cpfMascarado && <div className="font-mono text-xs text-muted-foreground">CPF {escolhido.cpfMascarado}</div>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Trocar participante"
              onClick={() => {
                setEscolhido(null);
                setModo("busca");
              }}
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {modo === "novo" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Novo participante</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                apagarRascunho(chaveRascunho);
                setRecuperado(false);
                setModo("busca");
              }}
            >
              Voltar à busca
            </Button>
          </div>
          {recuperado && (
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Recuperamos o que você tinha digitado.
              {exigeAssinatura && " A assinatura não é guardada: peça para a pessoa assinar de novo."}
            </p>
          )}
          <div>
            <Label htmlFor="n-nome" className="mb-1.5">
              Nome completo
            </Label>
            <Input id="n-nome" name="nome" value={nome} onChange={(ev) => setNome(ev.target.value)} className="h-11 text-base" aria-invalid={!!e.nome} />
            <Erro msg={e.nome} />
            {state.pedirHomonimo && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" name="homonimo" className="size-4 accent-primary" />É outra pessoa com o mesmo nome
              </label>
            )}
          </div>
          <div>
            <Label htmlFor="n-cbo" className="mb-1.5">
              Ocupação (CBO)
            </Label>
            <CboCampo id="n-cbo" name="cbo" inicial={cbo} onMudar={setCbo} invalido={!!e.cbo} />
            <Erro msg={e.cbo} />
          </div>
          <div>
            <Label htmlFor="n-setor" className="mb-1.5">
              Setor (opcional)
            </Label>
            <Input id="n-setor" name="setor" list="setores-cliente" value={setor} onChange={(ev) => setSetor(ev.target.value)} className="h-11 text-base" />
            <datalist id="setores-cliente">
              {setores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          {exigeCpf && (
            <div>
              <Label htmlFor="n-cpf" className="mb-1.5">
                CPF
              </Label>
              <Input
                id="n-cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(ev) => setCpf(formatarCpf(ev.target.value))}
                className="h-11 text-base"
                aria-invalid={!!e.cpf}
              />
              <Erro msg={e.cpf} />
            </div>
          )}
        </div>
      )}

      {modo !== "busca" && exigeAssinatura && (
        <div>
          <div className="mb-1.5 text-sm font-medium">Assinatura do participante</div>
          <AssinaturaCampo name="assinatura" invalido={!!e.assinatura} onMudar={setAssinado} />
          <Erro msg={e.assinatura} />
        </div>
      )}

      {modo !== "busca" && (
        <Button type="submit" disabled={!podeConfirmar || pending} className="h-12 w-full text-base">
          {pending && <Loader2 className="animate-spin" />}
          Confirmar presença
        </Button>
      )}
    </form>
  );
}

function LinhaPresenca({ visitaId, p }: { visitaId: string; p: PresencaVisita }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{p.nome}</div>
        <div className="truncate text-xs text-muted-foreground">
          {juntar(p.cbo.titulo, p.setor)}
          {p.cpf && ` · ${mascararCpf(p.cpf)}`}
        </div>
      </div>
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

/** Lista de presença da visita em andamento. */
export function ParticipantesVisita({ presencas, ehTreinamento, ...config }: Config & { presencas: PresencaVisita[]; ehTreinamento: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Participantes ({presencas.length})</h2>
          <Badge variant={config.exigeAssinatura ? "default" : "secondary"}>
            {config.exigeAssinatura ? (
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
              <LinhaPresenca key={p.participanteId} visitaId={config.visitaId} p={p} />
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

        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setAberto(true)}>
          <Plus />
          Adicionar participante
        </Button>

        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar participante</DialogTitle>
              <DialogDescription>
                {config.exigeAssinatura ? "Este cliente exige a assinatura de cada participante." : "Basta registrar o nome na lista."}
              </DialogDescription>
            </DialogHeader>
            {aberto && <AdicionarForm {...config} onFeito={() => setAberto(false)} />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
