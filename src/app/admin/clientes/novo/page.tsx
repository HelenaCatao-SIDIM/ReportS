import { PageHeader } from "@/components/shell/placeholder";
import { ClienteForm } from "../cliente-form";
import { criarCliente } from "../actions";

export default function NovoClientePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader titulo="Novo cliente" descricao="Depois de criar, você cadastra as unidades e os setores do cliente." />
      <ClienteForm acao={criarCliente} />
    </div>
  );
}
