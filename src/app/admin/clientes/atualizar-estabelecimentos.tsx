"use client";

import { useState } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { importarMunicipalDoCliente, type ResultadoMunicipalCnes } from "./cnes-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClienteItem {
  id: string;
  nome: string;
  totalUnidades: number;
}

type Estado = "fila" | "rodando" | "feito";
type Linha = { cliente: ClienteItem; estado: Estado; res?: ResultadoMunicipalCnes };

const MOTIVO: Record<string, string> = {
  sem_municipio: "município não reconhecido no nome",
  ambiguo: "nome ambíguo (vários estados) — use Buscar do CNES",
  cnes_vazio: "o CNES não devolveu a rede municipal",
  erro: "falhou",
};

/** Atualiza os estabelecimentos de vários clientes pelo CNES, um a um (cada um é uma chamada curta, com progresso). */
export function AtualizarEstabelecimentos({ clientes }: { clientes: ClienteItem[] }) {
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [rodando, setRodando] = useState(false);

  function abrir() {
    // Pré-marca os clientes sem estabelecimento (os que mais precisam).
    setMarcados(new Set(clientes.filter((c) => c.totalUnidades === 0).map((c) => c.id)));
    setLinhas(null);
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

  async function rodar() {
    const sel = clientes.filter((c) => marcados.has(c.id));
    if (!sel.length) return;
    setRodando(true);
    const ls: Linha[] = sel.map((c) => ({ cliente: c, estado: "fila" }));
    setLinhas([...ls]);
    for (let i = 0; i < ls.length; i++) {
      ls[i] = { ...ls[i], estado: "rodando" };
      setLinhas([...ls]);
      const res = await importarMunicipalDoCliente(ls[i].cliente.id).catch((): ResultadoMunicipalCnes => ({ ok: false, motivo: "erro" }));
      ls[i] = { ...ls[i], estado: "feito", res };
      setLinhas([...ls]);
    }
    setRodando(false);
  }

  return (
    <>
      <Button variant="outline" className="h-9" onClick={abrir}>
        <CloudDownload />
        Atualizar estabelecimentos
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !rodando && setAberto(o)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Atualizar estabelecimentos pelo CNES</DialogTitle>
            <DialogDescription>
              Marque os clientes. Para cada um, o município é deduzido do nome e a rede municipal (gestão municipal) é importada do CNES — sem duplicar (de-dup por CNES). Já vêm marcados os sem estabelecimento.
            </DialogDescription>
          </DialogHeader>

          {!linhas ? (
            <>
              <div className="max-h-[50vh] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 text-center font-medium">Estab.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clientes.map((c) => (
                      <tr key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => alternar(c.id)}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" className="size-4 accent-primary" checked={marcados.has(c.id)} onChange={() => alternar(c.id)} onClick={(e) => e.stopPropagation()} />
                        </td>
                        <td className="px-3 py-1.5">{c.nome}</td>
                        <td className="px-3 py-1.5 text-center tabular-nums text-muted-foreground">{c.totalUnidades}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button onClick={rodar} disabled={marcados.size === 0}>
                  <CloudDownload />
                  Atualizar {marcados.size} {marcados.size === 1 ? "cliente" : "clientes"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="max-h-[50vh] divide-y overflow-auto rounded-md border text-sm">
                {linhas.map((l) => (
                  <div key={l.cliente.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate">{l.cliente.nome}</span>
                    <span className="shrink-0 text-xs">
                      {l.estado === "fila" && <span className="text-muted-foreground">na fila…</span>}
                      {l.estado === "rodando" && <Loader2 className="inline size-4 animate-spin" />}
                      {l.estado === "feito" && l.res && (l.res.ok ? (
                        <span className="text-emerald-700">
                          {l.res.incluidos} novos · {l.res.atualizados} atualizados ({l.res.municipio})
                        </span>
                      ) : (
                        <span className="text-amber-700">pulado: {MOTIVO[l.res.motivo] ?? l.res.motivo}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAberto(false)} disabled={rodando}>
                  {rodando ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Processando…
                    </>
                  ) : (
                    "Fechar"
                  )}
                </Button>
              </DialogFooter>
              {!rodando && <p className="text-xs text-muted-foreground">Recarregue a página para ver os números de estabelecimentos atualizados.</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
