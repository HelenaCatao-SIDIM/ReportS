import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/cronograma/importar">) {
  return <GuardaTela tela="/admin/cronograma/importar">{children}</GuardaTela>;
}
