import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/placeholder";
import { ImportarCronograma } from "./importar-cronograma";

export default function ImportarCronogramaPage() {
  return (
    <>
      <Link href="/admin/cronograma" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Cronograma
      </Link>
      <PageHeader titulo="Importar cronograma" descricao="Suba uma planilha do Excel com os prazos. Você confere tudo antes de gravar: o que não existir no cadastro vira uma pergunta, cadastrar ou alterar." />
      <ImportarCronograma />
    </>
  );
}
