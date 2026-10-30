# Teste dos chamados de suporte no relatório

Pré-requisitos: fluxo do n8n importado e ativo (`docs/n8n-resumo-chamados.md`) e, no `.env.local`, as variáveis do README
(`CHAMADOS_SUPORTE=true`, URL e chave). Reinicie o `npm run dev` depois de mudar o `.env.local`.

1. `npm run lint` e `npm run build` sem erros.
2. Com `CHAMADOS_SUPORTE=false`: o relatório fica exatamente como antes.
3. Administração (`gestor@sidim.com.br`) → **Clientes** → editar um cliente → preencha **Nome no SINC** com o nome de um cliente real (o mesmo do campo Cliente / Município dos atendimentos) → salvar. O campo só aparece com `CHAMADOS_SUPORTE=true`.
   O nome aparece no detalhe do cliente.
4. **Relatórios → Novo relatório** desse cliente, num período com chamados conhecidos:
   o bloco **Chamados de suporte** aparece no rascunho, com o total, as três tabelas e "Ver os N chamados".
   Confira o total com a tabela `atendimentos` no n8n, no mesmo período.
5. Cliente **sem** Nome no SINC: a administração vê "Cliente sem vínculo com o SINC".
6. Emita o relatório → **Caixa de saída** → **Ver relatório** (página do aprovador):
   aparecem os totais e as tabelas, **sem** a lista de chamados e **sem** nomes de atendentes.
7. Emita de novo (ou abra a versão v1 depois de mudar dados no n8n): os números da v1 não mudam (congelados).
8. n8n desligado ou URL errada: o relatório é emitido mesmo assim, com "Dados de suporte indisponíveis".
9. `CHAMADOS_SUPORTE_PDF=true`: a capa do PDF ganha o resumo; com `false`, o PDF fica como antes.
10. No navegador (aba Rede), a chave do n8n não aparece em nenhuma requisição.
11. **Chamados por sistema** (com o fluxo do n8n atualizado: reimporte `docs/n8n-resumo-chamados.json`): o relatório é de um contrato (cliente e sistema) e conta só os chamados do sistema dele.
    - O sistema precisa ter o **Nome no Fortics** preenchido em Configurações > Sistemas do SINC, igual ao valor que o Fortics grava no campo `sistema` (confira antes; veja `docs/n8n-resumo-chamados.md`).
    - Com o nome: o bloco mostra "Só os chamados do sistema … no Fortics", e o total bate com a tabela `atendimentos` filtrada por cliente e sistema.
    - Sem o nome: o bloco mostra o aviso "Todos os sistemas do cliente…" (para a administração; o aprovador não vê) e o total é o do cliente inteiro.
    - Na versão de desenvolvimento em memória, os sistemas não têm Nome no Fortics (ele vem do SINC); para testar o filtro sem o SINC, use o fluxo do n8n direto com `curl` (tabela de casos no guia do fluxo).
