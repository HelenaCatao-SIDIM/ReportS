import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/configuracoes">) {
  return <GuardaTela tela="/admin/configuracoes">{children}</GuardaTela>;
}
