import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/visitas">) {
  return <GuardaTela tela="/admin/visitas">{children}</GuardaTela>;
}
