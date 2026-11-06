# Teste: emitir, prévia, enviar e nova versão

Para o ambiente de teste local (README, "Sem o SINC: ambiente de teste no seu computador"). Entre como `admin@teste.local` (senha `sidim123`).

1. **Relatórios → Novo relatório** (Prefeitura de Vale Verde, SCA, um período) → **Gerar rascunho**. Na tela aparecem **Atualizar**, **Baixar prévia** e **Emitir v1**. Ainda não há botão de enviar.
2. **Baixar prévia:** o PDF baixa como `PRÉVIA - Relatório Sintético - Prefeitura de Vale Verde - SCA - 01-11-2025 a 30-11-2025 - v1.pdf`, com o aviso "PRÉVIA" na capa. Nenhuma versão é registrada.
3. **Emitir v1:** o aviso diz que nada foi enviado. O status é **Emitido**, a Caixa de saída não ganha e-mail, e o histórico mostra "Ainda não enviada por e-mail". O PDF da v1 baixa como `Relatório Sintético - Prefeitura de Vale Verde - SCA - 01-11-2025 a 30-11-2025 - v1.pdf`.
4. **Atualizar** continua disponível depois de emitido. Depois dele, **Emitir v2**: a v1 aparece como "Substituída pela v2".
5. **Enviar v2 por e-mail:** a janela lista os aprovadores. Depois de enviar, o status é **Enviado**, a Caixa de saída tem um e-mail por aprovador (assunto e anexo com o nome do relatório) e o botão passa a **Reenviar v2** (os links já enviados continuam valendo).
6. Mesmo enviado, dá para **Emitir v3**: o status volta a **Emitido** e o link da v2 deixa de aprovar.
7. **Sem aprovador e sem CNPJ:** em Clientes → contrato, desmarque todos os aprovadores e salve (funciona). Limpe o CNPJ do cliente. O relatório emite normalmente (o PDF mostra "—" no CNPJ), o botão de enviar fica desabilitado e a tela diz para baixar o PDF e enviar por fora.
8. Depois que um aprovador **aprova**, o relatório e as visitas ficam travados: não há mais Atualizar nem Emitir.
