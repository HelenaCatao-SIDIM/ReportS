import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/clientes">) {
  return <GuardaTela tela="/admin/clientes">{children}</GuardaTela>;
}
