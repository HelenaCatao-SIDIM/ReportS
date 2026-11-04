import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/cronograma">) {
  return <GuardaTela tela="/admin/cronograma">{children}</GuardaTela>;
}
