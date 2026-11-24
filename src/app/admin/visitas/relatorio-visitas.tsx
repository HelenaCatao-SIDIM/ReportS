"use client";

import { useState } from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface VisitaParaRelatorio {
  id: string;
  data: string;
  clienteNome: string;
  sistemaNome: string;
  unidadeNome: string;
  tipo: string;
  horario: string;
}

/** Lê o nome do arquivo do cabeçalho Content-Disposition (prefere o `filename*` em UTF-8). */
function nomeDoCabecalho(cd: string | null): string {
  if (!cd) return "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* cai para o ASCII */
    }
  }
  return /filename="([^"]+)"/i.exec(cd)?.[1] ?? "";
}

/**
 * Gera um relatório avulso em PDF só com as visitas escolhidas (sem atendimentos do suporte). Pode misturar clientes. Baixa o
 * PDF na hora, sem registrar versão nem enviar nada. Trabalha sobre as visitas encerradas que a tela está mostrando.
 */
export function RelatorioDeVisitas({ visitas }: { visitas: VisitaParaRelatorio[] }) {
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  function abrir() {
    setMarcados(new Set());
    setErro("");
    setAberto(true);
  }
  function alternar(id: string) {
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const todasMarcadas = visitas.length > 0 && marcados.size === visitas.length;
  function alternarTodas() {
    setMarcados(todasMarcadas ? new Set() : new Set(visitas.map((v) => v.id)));
  }

  async function gerar() {
    if (!marcados.size || gerando) return;
    setGerando(true);
    setErro("");
    try {
      const resp = await fetch("/relatorio-visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...marcados] }),
      });
      if (!resp.ok) {
        setErro((await resp.text()) || "Não foi possível gerar o relatório.");
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoCabecalho(resp.headers.get("Content-Disposition")) || "Relatório de visitas.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAberto(false);
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="h-9" onClick={abrir} disabled={visitas.length === 0}>
        <FileText />
        Gerar relatório de visitas
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !gerando && setAberto(o)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Relatório de visitas</DialogTitle>
            <DialogDescription>
              Marque as visitas que entram no PDF. Sai só com as visitas (sem atendimentos do suporte) e pode misturar clientes. O documento é baixado na hora — nada é salvo nem enviado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {marcados.size} de {visitas.length} marcada{visitas.length === 1 ? "" : "s"}
            </span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={alternarTodas}>
              {todasMarcadas ? "Limpar seleção" : "Selecionar todas"}
            </button>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Cliente / estabelecimento</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visitas.map((v) => (
                  <tr key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => alternar(v.id)}>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={marcados.has(v.id)}
                        onChange={() => alternar(v.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {v.data}
                      <span className="block text-xs text-muted-foreground">{v.horario}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      {v.clienteNome}
                      <span className="block text-xs text-muted-foreground">
                        {v.sistemaNome} · {v.unidadeNome}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{v.tipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={gerando}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={marcados.size === 0 || gerando}>
              {gerando ? <Loader2 className="animate-spin" /> : <FileText />}
              {gerando ? "Gerando…" : `Gerar (${marcados.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
