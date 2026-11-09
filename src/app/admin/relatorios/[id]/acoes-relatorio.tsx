"use client";

import { useState, useTransition } from "react";
import { AlertCircle, FileDown, FilePlus2, Loader2, Mail, RefreshCw, Send, Trash2 } from "lucide-react";
import { apagarRascunho, emitir, enviar, recalcularVisitas } from "../actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  id: string;
  /** Rascunho nunca emitido pode ser excluído. */
  podeExcluir: boolean;
  /** Número da versão que a próxima emissão vai criar (1 para a primeira). */
  proximaVersao: number;
  /** Última versão já emitida (0 se nenhuma). */
  ultimaVersao: number;
  /** A última versão já foi enviada por e-mail. */
  jaEnviada: boolean;
  aprovadores: { nome: string; email: string }[];
  visitas: number;
  horas: string;
  /** Motivo de não poder emitir agora (ex.: período sem visitas e sem chamados), ou null. */
  bloqueio: string | null;
}

/** Ações do relatório até a aprovação: atualizar, baixar prévia, excluir rascunho, emitir uma versão (sem enviar) e enviar por e-mail. */
export function AcoesRelatorio({ id, podeExcluir, proximaVersao, ultimaVersao, jaEnviada, aprovadores, visitas, horas, bloqueio }: Props) {
  const [pendente, start] = useTransition();
  const [dialogo, setDialogo] = useState<"emitir" | "enviar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const semAprovadores = aprovadores.length === 0;

  function executar(acao: (id: string) => Promise<string | null>) {
    setErro(null);
    start(async () => {
      const e = await acao(id);
      if (e) setErro(e);
    });
  }
  const fechar = () => !pendente && (setDialogo(null), setErro(null));

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={pendente} onClick={() => start(() => recalcularVisitas(id))}>
          {pendente && !dialogo ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Atualizar
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={`/admin/relatorios/${id}/previa`} download />}>
          <FileDown />
          Baixar prévia
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
        <Button variant={ultimaVersao > 0 ? "outline" : "default"} disabled={pendente || !!bloqueio} onClick={() => setDialogo("emitir")}>
          <FilePlus2 />
          Emitir v{proximaVersao}
        </Button>
        {ultimaVersao > 0 && (
          <Button disabled={pendente || semAprovadores} onClick={() => setDialogo("enviar")} title={semAprovadores ? "O contrato não tem aprovadores ativos" : undefined}>
            <Send />
            {jaEnviada ? `Reenviar v${ultimaVersao}` : `Enviar v${ultimaVersao} por e-mail`}
          </Button>
        )}
      </div>
      {bloqueio && <p className="max-w-md text-right text-xs text-muted-foreground">{bloqueio}</p>}
      {ultimaVersao > 0 && semAprovadores && (
        <p className="max-w-md text-right text-xs text-muted-foreground">Sem aprovadores ativos neste contrato: baixe o PDF da versão e envie por fora.</p>
      )}
      {erro && !dialogo && (
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <Dialog open={dialogo === "emitir"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir versão v{proximaVersao}</DialogTitle>
            <DialogDescription>
              Gera o PDF e congela esta versão com os dados de agora. <b>Não envia e-mail</b>: depois você baixa o PDF ou usa &quot;Enviar por e-mail&quot;.
              {ultimaVersao > 0 && ` A v${ultimaVersao} continua guardada no histórico.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Visitas</div>
              <div className="font-medium">{visitas}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-xs text-muted-foreground">Horas presenciais</div>
              <div className="font-medium">{horas}</div>
            </div>
          </div>
          {erro && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pendente} onClick={fechar}>
              Voltar
            </Button>
            <Button disabled={pendente} onClick={() => executar(emitir)}>
              {pendente ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
              {pendente ? "Gerando PDF…" : `Emitir v${proximaVersao}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === "enviar"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {jaEnviada ? "Reenviar" : "Enviar"} a v{ultimaVersao} por e-mail
            </DialogTitle>
            <DialogDescription>
              Envia o PDF da v{ultimaVersao} e o botão &quot;Ver relatório&quot;, para aprovar ou pedir ajuste. Basta a decisão de um dos aprovadores.
              {jaEnviada && " Os links já enviados continuam valendo."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <div className="mb-1 text-xs text-muted-foreground">Será enviado para</div>
            <ul className="space-y-1">
              {aprovadores.map((a) => (
                <li key={a.email} className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {a.nome} <span className="text-muted-foreground">· {a.email}</span>
                </li>
              ))}
            </ul>
          </div>
          {erro && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pendente} onClick={fechar}>
              Voltar
            </Button>
            <Button disabled={pendente || semAprovadores} onClick={() => executar(enviar)}>
              {pendente ? <Loader2 className="animate-spin" /> : <Send />}
              {pendente ? "Enviando…" : jaEnviada ? "Reenviar" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
