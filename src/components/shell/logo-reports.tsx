import Image from "next/image";

/** Logo do ReportS (símbolo e nome), com fundo transparente. Os ícones do navegador ficam em `src/app` (favicon, icon, apple-icon). */
const LOGO = { arquivo: "/reports/logo.png", largura: 528, altura: 160 } as const;

/** `altura` em px; a largura segue a proporção da imagem. */
export function LogoReports({ altura = 28, className }: { altura?: number; className?: string }) {
  return (
    <Image
      src={LOGO.arquivo}
      alt="ReportS"
      width={Math.round((altura * LOGO.largura) / LOGO.altura)}
      height={altura}
      className={className}
      loading="eager"
      unoptimized
    />
  );
}
