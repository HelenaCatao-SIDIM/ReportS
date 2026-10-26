"use client";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:) da foto escolhida */
import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { comprimirImagem } from "@/lib/imagem";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Captura uma foto (câmera traseira, ou galeria quando `origem="galeria"`), comprime para ~500 KB
 * e coloca o arquivo comprimido no campo oculto `name`, que segue no FormData do formulário.
 */
export function FotoCampo({
  name,
  origem = "camera",
  rotulo,
  invalido,
  onMudar,
}: {
  name: string;
  origem?: "camera" | "galeria";
  rotulo: string;
  invalido?: boolean;
  onMudar?: (temFoto: boolean) => void;
}) {
  const seletor = useRef<HTMLInputElement>(null);
  const oculto = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<number | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    setProcessando(true);
    setErro(null);
    try {
      const comprimido = await comprimirImagem(original);
      const dt = new DataTransfer();
      dt.items.add(comprimido);
      oculto.current!.files = dt.files;
      setPrevia(URL.createObjectURL(comprimido));
      setTamanho(comprimido.size);
      onMudar?.(true);
    } catch {
      setErro("Não foi possível usar esta imagem. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  const Icone = origem === "camera" ? Camera : ImageIcon;

  return (
    <div>
      <input
        ref={seletor}
        type="file"
        accept="image/*"
        capture={origem === "camera" ? "environment" : undefined}
        onChange={aoEscolher}
        className="hidden"
        aria-label={rotulo}
      />
      <input ref={oculto} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden />

      {previa ? (
        <div className="relative overflow-hidden rounded-xl border">
          <img src={previa} alt={rotulo} className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/90 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{tamanho ? `${Math.round(tamanho / 1024)} KB` : ""}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => seletor.current?.click()}>
              <RefreshCw />
              Trocar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => seletor.current?.click()}
          disabled={processando}
          className={cn(
            "flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50",
            invalido && "border-destructive/60 text-destructive",
          )}
        >
          {processando ? <Loader2 className="size-7 animate-spin" /> : <Icone className="size-7" />}
          {processando ? "Preparando a foto…" : origem === "camera" ? "Tirar foto" : "Escolher imagem"}
        </button>
      )}
      {erro && <p className="mt-1.5 text-xs text-destructive">{erro}</p>}
    </div>
  );
}
