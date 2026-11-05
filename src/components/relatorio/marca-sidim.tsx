import Image from "next/image";
import { ASSINANTE, ASSINATURA, LOGO, linhasDaEmpresa } from "@/lib/sidim";

/** Logo da SIDIM (a imagem tem fundo branco: fica em uma caixa branca). `unidades`: altura em px. */
export function LogoSidim({ altura = 32 }: { altura?: number }) {
  return (
    <span className="inline-flex shrink-0 rounded bg-white">
      <Image src={LOGO.arquivo} alt="SIDIM Tecnologia" width={Math.round((altura * LOGO.largura) / LOGO.altura)} height={altura} priority unoptimized />
    </span>
  );
}

/** Fim do relatório: assinatura do responsável sobre a linha, nome embaixo, e os dados da SIDIM. Sempre em fundo branco (a assinatura é escura). */
export function AssinaturaSidim() {
  const linhas = linhasDaEmpresa();
  return (
    <section className="rounded-xl border bg-white p-5 text-slate-900">
      <div className="mx-auto w-64">
        <Image src={ASSINATURA.arquivo} alt={`Assinatura de ${ASSINANTE.nome}`} width={208} height={Math.round((208 * ASSINATURA.altura) / ASSINATURA.largura)} className="-mb-2 ml-2" unoptimized />
        <div className="border-t border-slate-400" />
        <div className="mt-1 text-sm font-semibold">{ASSINANTE.nome}</div>
        <div className="text-xs text-slate-500">{ASSINANTE.empresa}</div>
      </div>
      {linhas.length > 1 && (
        <div className="mt-4 space-y-0.5 border-t pt-3 text-center text-xs text-slate-500">
          {linhas.map((l, i) => (
            <div key={i} className={i === 0 ? "font-medium text-slate-700" : undefined}>
              {l}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
