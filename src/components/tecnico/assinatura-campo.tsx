"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Quadro de assinatura com o dedo (ou mouse). A cada traço, a imagem PNG vai para o
 * campo de arquivo oculto `name`, que segue no FormData do formulário.
 */
export function AssinaturaCampo({ name, invalido, onMudar }: { name: string; invalido?: boolean; onMudar?: (assinado: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const oculto = useRef<HTMLInputElement>(null);
  const desenhando = useRef(false);
  const [assinado, setAssinado] = useState(false);

  // Ajusta a resolução à tela (nítido em celulares com alta densidade).
  useEffect(() => {
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e3a8a";
  }, []);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    canvas.current!.toBlob((blob) => {
      if (!blob) return;
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "assinatura.png", { type: "image/png" }));
      oculto.current!.files = dt.files;
      setAssinado(true);
      onMudar?.(true);
    }, "image/png");
  }

  function limpar() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    oculto.current!.value = "";
    setAssinado(false);
    onMudar?.(false);
  }

  return (
    <div>
      <input ref={oculto} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden />
      <div className={cn("relative rounded-xl border-2 bg-white", invalido && !assinado ? "border-destructive/60" : "border-dashed")}>
        <canvas
          ref={canvas}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          aria-label="Quadro de assinatura"
          className="h-40 w-full touch-none"
        />
        {!assinado && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Assine aqui com o dedo</span>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-muted-foreground/30" />
      </div>
      {assinado && (
        <Button type="button" variant="ghost" size="sm" onClick={limpar} className="mt-1">
          <Eraser />
          Limpar e assinar de novo
        </Button>
      )}
    </div>
  );
}
