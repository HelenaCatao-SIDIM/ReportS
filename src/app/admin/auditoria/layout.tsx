import { GuardaTela } from "@/components/shell/area-protegida";

export default function Layout({ children }: LayoutProps<"/admin/auditoria">) {
  return <GuardaTela tela="/admin/auditoria">{children}</GuardaTela>;
}
