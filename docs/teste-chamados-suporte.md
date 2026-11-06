# Teste dos chamados de suporte no relatório

Os chamados são **sempre ativos** (não há como desligar) e a conexão com o n8n é configurada na tela, sem variável de ambiente.
Pré-requisito: o fluxo do n8n importado e ativo (`docs/n8n-resumo-chamados.md`).

1. `npm run lint` e `npm run build` sem erros.
2. **Conexão:** Administração → **Configurações** (menu "Sistema"). Informe o endereço do webhook de produção do fluxo (não há chave) e clique em **Salvar e testar**.
   - Endereço que não é `https://` é recusado (em desenvolvimento, `http://` é aceito).
   - Endereço errado ou fluxo inativo: "Endereço não encontrado no n8n". Webhook ainda com credencial: "O n8n recusou o pedido" (ponha *Authentication: None*). n8n fora do ar: "Não foi possível falar com o n8n".
   - Certo: "Conexão funcionando". Ao recarregar a tela, o endereço volta preenchido; **Testar de novo** testa o endereço guardado.
3. **Nada a preencher:** os chamados são buscados pelo nome do cliente no SINC. Só se o Fortics grava o cliente com outro nome, vá em Administração → **Clientes** → editar → **Outros nomes nos atendimentos** e informe como aparece no campo Cliente / Município (um por linha). O detalhe do cliente mostra esses nomes.
4. **Relatórios → Novo relatório** desse cliente, num período com chamados conhecidos:
   o bloco **Chamados de suporte** aparece no rascunho, com o total, as três tabelas e "Ver os N chamados".
   Confira o total com a tabela `atendimentos` no n8n, no mesmo período.
5. A Administração vê, no bloco, "Chamados buscados pelo nome: …" (o nome do cliente no SINC e os outros cadastrados). Cliente sem chamados no período: o aviso diz para cadastrar o outro nome, se o Fortics usa um diferente. Conexão **não configurada**: a administração vê o aviso com o link para Configurações; o aprovador e o PDF **não** mostram o bloco.
6. **Emitir v1**, depois **Enviar v1 por e-mail** → **Caixa de saída** → **Ver relatório** (página do aprovador):
   aparecem os totais e as tabelas, **sem** a lista de chamados e **sem** nomes de atendentes. A capa do PDF também traz o resumo.
7. Mude os dados no n8n e abra a v1 no histórico: os números da v1 não mudam (congelados). **Atualizar** e **Emitir v2** trazem os números novos.
8. n8n desligado ou endereço errado: o relatório com visitas é emitido mesmo assim, com "Dados de suporte indisponíveis".
9. O pedido ao n8n não leva chave nem credencial (nenhum cabeçalho de autenticação), e a tela de Configurações não tem campo de senha.
10. **Chamados por sistema** (com o fluxo do n8n atualizado: reimporte `docs/n8n-resumo-chamados.json`): o relatório é de um contrato (cliente e sistema) e conta só os chamados do sistema dele.
    - O sistema precisa ter o **Nome no Fortics** preenchido em Configurações > Sistemas do SINC, igual ao valor que o Fortics grava no campo `sistema` (confira antes; veja `docs/n8n-resumo-chamados.md`).
    - Com o nome: o bloco mostra "Só os chamados do sistema … no Fortics", e o total bate com a tabela `atendimentos` filtrada por cliente e sistema.
    - Sem o nome: o bloco mostra o aviso "Todos os sistemas do cliente…" (para a administração; o aprovador não vê) e o total é o do cliente inteiro.
11. **Mês sem visitas:** Relatórios → Novo relatório de um período em que o cliente não teve visita. O rascunho é criado ("Nenhuma visita." e "0 visitas"), o bloco de chamados aparece e **Emitir v1** fica habilitado, com ou sem chamados no período. O PDF não tem horas nem tabela de visitas; o e-mail diz "Nenhuma visita registrada no período". Se o n8n não puder ser consultado (fora do ar ou conexão não configurada), o botão fica desabilitado e a tela explica.
12. **Permissão:** quem não tem `reports.relatorios.gerenciar` não abre Configurações.
13. **Sintético e analítico:** em Administração → Clientes → contrato, a seção "Relatório de atendimentos do suporte" vem com **Sintético** marcado (também nos contratos que já existiam).
    - **Sintético:** emita um relatório. O PDF traz o painel (atendimentos, espera média, atendimento médio, tempo total e "por tabulação", com barras, quantidades, porcentagens e linhas finas) e **não** traz a lista nem nomes de solicitantes.
    - Troque para **Analítico**, salve, e emita outro período. O rascunho mostra o selo "Relatório analítico". O PDF traz o mesmo painel e, depois da capa, "Atendimentos do suporte — lista completa", com todos os atendimentos do mais antigo ao mais recente (20 por página, cabeçalho repetido): data e horário, tempo, solicitante, técnico, assunto e tabulação, **sem protocolo**. O texto do PDF confere com a contagem do painel.
    - A página do aprovador mostra só o painel, nos dois tipos. A Administração vê a lista completa em "Ver os N atendimentos".
    - Sem o dado no n8n (sem solicitante ou sem TMA no histórico): a lista mostra "—" e o chamado sem TMA fica fora do atendimento médio e do tempo total. Relatórios emitidos antes de 06/11/2026 continuam como foram enviados (tempo pelo encerramento menos a abertura).

