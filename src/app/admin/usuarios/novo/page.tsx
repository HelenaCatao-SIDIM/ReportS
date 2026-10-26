import { PageHeader } from "@/components/shell/placeholder";
import { UsuarioForm } from "../usuario-form";
import { criar } from "../actions";

export default function NovoUsuarioPage() {
  return (
    <>
      <PageHeader titulo="Novo usuário" descricao="O usuário entra com este e-mail e a senha inicial." />
      <UsuarioForm acao={criar} />
    </>
  );
}
