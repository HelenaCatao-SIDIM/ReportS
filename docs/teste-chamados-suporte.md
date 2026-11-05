# Teste dos chamados de suporte no relatório

Os chamados são **sempre ativos** (não há como desligar) e a conexão com o n8n é configurada na tela, sem variável de ambiente.
Pré-requisito: o fluxo do n8n importado e ativo (`docs/n8n-resumo-chamados.md`).

1. `npm run lint` e `npm run build` sem erros.
2. **Conexão:** Administração → **Configurações** (menu "Sistema"). Informe o endereço do webhook de produção do fluxo (não há chave) e clique em **Salvar e testar**.
   - Endereço que não é `https://` é recusado (em desenvolvimento, `http://` é aceito).
   - Endereço errado ou fluxo inativo: "Endereço não encontrado no n8n". Webhook ainda com credencial: "O n8n recusou o pedido" (ponha *Authentication: None*). n8n fora do ar: "Não foi possível falar com o n8n".
   - Certo: "Conexão funcionando". Ao recarregar a tela, o endereço volta preenchido; **Testar de novo** testa o endereço guardado.
3. Administração → **Clientes** → editar um cliente → preencha **Nome no SINC** com o nome de um cliente real (o mesmo do campo Cliente / Município dos atendimentos) → salvar. O nome aparece no detalhe do cliente.
4. **Relatórios → Novo relatório** desse cliente, num período com chamados conhecidos:
   o bloco **Chamados de suporte** aparece no rascunho, com o total, as três tabelas e "Ver os N chamados".
   Confira o total com a tabela `atendimentos` no n8n, no mesmo período.
5. Cliente **sem** Nome no SINC: a administração vê "Cliente sem vínculo com o SINC". Conexão **não configurada**: a administração vê o aviso com o link para Configurações. Nos dois casos o aprovador e o PDF **não** mostram o bloco.
6. Emita o relatório → **Caixa de saída** → **Ver relatório** (página do aprovador):
   aparecem os totais e as tabelas, **sem** a lista de chamados e **sem** nomes de atendentes. A capa do PDF também traz o resumo.
7. Emita de novo (ou abra a versão v1 depois de mudar dados no n8n): os números da v1 não mudam (congelados).
8. n8n desligado ou endereço errado: o relatório com visitas é emitido mesmo assim, com "Dados de suporte indisponíveis".
9. O pedido ao n8n não leva chave nem credencial (nenhum cabeçalho de autenticação), e a tela de Configurações não tem campo de senha.
10. **Chamados por sistema** (com o fluxo do n8n atualizado: reimporte `docs/n8n-resumo-chamados.json`): o relatório é de um contrato (cliente e sistema) e conta só os chamados do sistema dele.
    - O sistema precisa ter o **Nome no Fortics** preenchido em Configurações > Sistemas do SINC, igual ao valor que o Fortics grava no campo `sistema` (confira antes; veja `docs/n8n-resumo-chamados.md`).
    - Com o nome: o bloco mostra "Só os chamados do sistema … no Fortics", e o total bate com a tabela `atendimentos` filtrada por cliente e sistema.
    - Sem o nome: o bloco mostra o aviso "Todos os sistemas do cliente…" (para a administração; o aprovador não vê) e o total é o do cliente inteiro.
11. **Mês sem visitas:** Relatórios → Novo relatório de um período em que o cliente não teve visita. O rascunho é criado ("Nenhuma visita." e "0 visitas"), o bloco de chamados aparece e **Emitir e enviar** fica habilitado, com ou sem chamados no período. O PDF não tem horas nem tabela de visitas; o e-mail diz "Nenhuma visita registrada no período". Se o n8n não puder ser consultado (fora do ar, conexão não configurada ou cliente sem Nome no SINC), o botão fica desabilitado e a tela explica.
12. **Permissão:** quem não tem `reports.relatorios.gerenciar` não abre Configurações.
