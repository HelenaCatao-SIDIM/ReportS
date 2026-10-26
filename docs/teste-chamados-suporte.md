# Teste dos chamados de suporte no relatório

Pré-requisitos: fluxo do n8n importado e ativo (`docs/n8n-resumo-chamados.md`) e, no `.env.local`, as variáveis do README
(`CHAMADOS_SUPORTE=true`, URL e chave). Reinicie o `npm run dev` depois de mudar o `.env.local`.

1. `npm run lint` e `npm run build` sem erros.
2. Com `CHAMADOS_SUPORTE=false`: o relatório fica exatamente como antes.
3. Gestor → **Clientes** → editar um cliente → preencha **Nome no Fortics** com o nome de um cliente real do Fortics → salvar.
   O nome aparece no detalhe do cliente.
4. **Relatórios → Novo relatório** desse cliente, num período com chamados conhecidos:
   o bloco **Chamados de suporte** aparece no rascunho, com o total, as três tabelas e "Ver os N chamados".
   Confira o total com a tabela `atendimentos` no n8n, no mesmo período.
5. Cliente **sem** Nome no Fortics: o gestor vê "Cliente sem vínculo com o Fortics".
6. Emita o relatório → **Caixa de saída** → **Ver relatório** (página do aprovador):
   aparecem os totais e as tabelas, **sem** a lista de chamados e **sem** nomes de atendentes.
7. Emita de novo (ou abra a versão v1 depois de mudar dados no n8n): os números da v1 não mudam (congelados).
8. n8n desligado ou URL errada: o relatório é emitido mesmo assim, com "Dados de suporte indisponíveis".
9. `CHAMADOS_SUPORTE_PDF=true`: a capa do PDF ganha o resumo; com `false`, o PDF fica como antes.
10. No navegador (aba Rede), a chave do n8n não aparece em nenhuma requisição.
