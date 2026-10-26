"use client";

/* eslint-disable @next/next/no-img-element -- fotos do storage */
import { useRef, useState, useTransition } from "react";
import { Camera, ImageIcon, Loader2, Trash2 } from "lucide-react";
import type { Foto } from "@/lib/types";
import { comprimirImagem } from "@/lib/imagem";
import { apagarFotoExtra, enviarFotoExtra } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Fotos extras da visita: câmera ou galeria (várias), comprimidas e enviadas uma a uma. */
export function FotosExtras({ visitaId, fotos }: { visitaId: string; fotos: Foto[] }) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [fila, setFila] = useState<{ feitas: number; total: number } | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [, start] = useTransition();

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!arquivos.length) return;
    setFalhas(0);
    setFila({ feitas: 0, total: arquivos.length });
    let erros = 0;
    for (const [i, original] of arquivos.entries()) {
      try {
        const fd = new FormData();
        fd.set("foto", await comprimirImagem(original));
        if (await enviarFotoExtra(visitaId, fd)) erros++;
      } catch {
        erros++;
      }
      setFila({ feitas: i + 1, total: arquivos.length });
    }
    setFalhas(erros);
    setFila(null);
  }

  function remover(fotoId: string) {
    if (!confirm("Remover esta foto?")) return;
    setRemovendo(fotoId);
    start(async () => {
      await apagarFotoExtra(visitaId, fotoId);
      setRemovendo(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Fotos extras</h2>
          <span className="text-xs text-muted-foreground">{fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</span>
        </div>

        <input ref={camera} type="file" accept="image/*" capture="environment" onChange={enviar} className="hidden" aria-label="Tirar foto extra" />
        <input ref={galeria} type="file" accept="image/*" multiple onChange={enviar} className="hidden" aria-label="Escolher fotos da galeria" />

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={!!fila} onClick={() => camera.current?.click()}>
            <Camera />
            Câmera
          </Button>
          <Button type="button" variant="outline" className="h-11" disabled={!!fila} onClick={() => galeria.current?.click()}>
            <ImageIcon />
            Galeria
          </Button>
        </div>

        {fila && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Enviando {Math.min(fila.feitas + 1, fila.total)} de {fila.total}…
          </p>
        )}
        {falhas > 0 && <p className="text-sm text-destructive">{falhas === 1 ? "1 foto não foi enviada." : `${falhas} fotos não foram enviadas.`} Tente de novo.</p>}

        {fotos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f) => (
              <div key={f.id} className="relative overflow-hidden rounded-lg border">
                <img src={f.url} alt="Foto extra" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remover(f.id)}
                  disabled={removendo === f.id}
                  aria-label="Remover foto"
                  className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow"
                >
                  {removendo === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          !fila && <p className="text-sm text-muted-foreground">Opcional. Sem limite de quantidade; cada foto é reduzida para ~500 KB.</p>
        )}
      </CardContent>
    </Card>
  );
}
