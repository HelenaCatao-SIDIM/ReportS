"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, Mail, RefreshCw, Send, Trash2 } from "lucide-react";
import { apagarRascunho, emitir, recalcularVisitas } from "../actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  id: string;
  podeExcluir: boolean;
  /** Próxima versão (1 para a primeira emissão). */
  proximaVersao: number;
  aprovadores: { nome: string; email: string }[];
  visitas: number;
  horas: string;
}

/** Ações do rascunho: recalcular visitas, excluir e emitir (PDF + e-mail aos aprovadores). */
export function AcoesRascunho({ id, podeExcluir, proximaVersao, aprovadores, visitas, horas }: Props) {
  const [pendente, start] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const semAprovadores = aprovadores.length === 0;

  function emitirAgora() {
    setErro(null);
    start(async () => {
      const e = await emitir(id);
      if (e) setErro(e);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pendente} onClick={() => start(() => recalcularVisitas(id))}>
        {pendente && !confirmando ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Atualizar visitas
      </Button>
      {podeExcluir && (
        <Button
          variant="ghost"
          disabled={pendente}
          onClick={() => confirm("Excluir este rascunho? As visitas ficam livres para outro relatório.") && start(() => apagarRascunho(id))}
        >
          <Trash2 />
          Excluir rascunho
        </Button>
      )}
      <Button disabled={pendente || visitas === 0} onClick={() => setConfirmando(true)}>
        <Send />
        {proximaVersao > 1 ? `Emitir v${proximaVersao}` : "Emitir e enviar"}
      </Button>

      <Dialog open={confirmando} onOpenChange={(o) => !pendente && setConfirmando(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir versão v{proximaVersao}</DialogTitle>
            <DialogDescription>
              O sistema gera o PDF, congela a lista de visitas e envia o e-mail com o PDF e o botão &quot;Ver relatório&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/60 p-2">
                <div className="text-xs text-muted-foreground">Visitas</div>
                <div className="font-medium">{visitas}</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <div className="text-xs text-muted-foreground">Horas presenciais</div>
                <div className="font-medium">{horas}</div>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Será enviado para</div>
              {semAprovadores ? (
                <p className="text-destructive">O cliente não tem aprovadores cadastrados.</p>
              ) : (
                <ul className="space-y-1">
                  {aprovadores.map((a) => (
                    <li key={a.email} className="flex items-center gap-2">
                      <Mail className="size-3.5 text-muted-foreground" />
                      {a.nome} <span className="text-muted-foreground">· {a.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {erro && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pendente} onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
            <Button disabled={pendente || semAprovadores} onClick={emitirAgora}>
              {pendente ? <Loader2 className="animate-spin" /> : <Send />}
              {pendente ? "Gerando PDF e enviando…" : "Emitir e enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
