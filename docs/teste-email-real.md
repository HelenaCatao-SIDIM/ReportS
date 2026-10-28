# Teste do envio real de e-mail (SMTP)

Sem `EMAIL_REAL=true` e `SMTP_HOST`, nada muda: os e-mails só aparecem em **Administração → Caixa de saída**.
O envio usa SMTP, o protocolo de qualquer conta de e-mail; não há conta nem serviço novo para criar.

## 1. Teste com o seu Gmail (o mais simples)

1. Na conta Google: **Segurança → Verificação em duas etapas** (precisa estar ligada) → **Senhas de app** → crie uma com o nome
   "SIDIM Visitas". Copie as 16 letras (sem os espaços). Essa senha vale só para isso e pode ser apagada depois.
2. No `.env.local` (nunca no Git), com cada variável em uma linha própria:

```
EMAIL_REAL=true
SMTP_HOST=smtp.gmail.com
SMTP_PORTA=465
SMTP_USUARIO=seu-email@gmail.com
SMTP_SENHA=<a senha de app>
EMAIL_REDIRECIONAR_PARA=seu-email@gmail.com
```

3. Reinicie o `npm run dev`.
4. Entre como `gestor@sidim.com.br`, gere um relatório (ex.: Prefeitura de Vale Verde, 01/10 a 31/10) e clique em **Emitir e enviar**.
5. A página avisa "e-mail enviado a 2 de 2 aprovador(es)". Na **Caixa de saída**, cada e-mail aparece como **Enviado**, com o
   identificador da mensagem e o aviso da trava de teste.
6. Abra a caixa de entrada (e o spam). Devem chegar dois e-mails, com assunto `[TESTE → Nome <e-mail do aprovador>] Relatório de
   atendimento SIDIM …`, o **PDF em anexo** e o botão **Ver relatório**.
7. Clique no botão: abre a página do aprovador com o link pessoal daquele aprovador. Aprove. O outro aprovador é avisado por e-mail
   (que também chega a você, pela trava).

Com `EMAIL_REDIRECIONAR_PARA` definida, **nada** vai para os aprovadores de verdade. O Gmail pessoal serve só para teste (limite
diário de envios e remetente pessoal); para os clientes, use o e-mail da SIDIM.

## 2. Enviar aos aprovadores de verdade

1. Peça ao responsável pelo e-mail da SIDIM uma **caixa dedicada** (ex.: `relatorios@dominio-da-sidim`) e os dados do SMTP:
   servidor, porta, usuário e senha. Confirme que o domínio tem SPF e DKIM configurados, para os e-mails não caírem no spam.
   - Microsoft 365: costuma ser `smtp.office365.com`, porta 587, e o administrador precisa liberar o "SMTP AUTH" da caixa.
   - Google Workspace: `smtp.gmail.com`, porta 465, com senha de app ou a conta de serviço indicada pelo administrador.
2. Troque no `.env.local` do servidor `SMTP_*` (e `EMAIL_REMETENTE`, se o remetente tiver outro nome de exibição).
3. Ajuste `APP_URL` para o endereço público do sistema (https), para o link abrir fora do seu computador.
4. **Só então** remova `EMAIL_REDIRECIONAR_PARA` e reinicie. A partir daí os e-mails vão aos aprovadores cadastrados.

## O que conferir quando algo falha

| Sintoma na Caixa de saída | Causa provável |
|---|---|
| "O servidor SMTP recusou o usuário ou a senha" | Senha errada ou comum (no Gmail precisa ser senha de app), ou verificação em duas etapas desligada |
| "Não foi possível falar com o servidor SMTP" | Servidor ou porta errados, firewall ou rede bloqueando a porta de envio (465/587) |
| "O servidor SMTP recusou a mensagem (550 …)" | Endereço do destinatário inexistente, ou o remetente não é permitido para essa conta |
| "O servidor SMTP respondeu 4xx" | Limite de envios ou problema temporário; o sistema já tenta uma segunda vez |
| Página: "O envio falhou para N aprovador(es)" | O relatório está emitido e os links existem; corrija a causa e emita uma nova versão |
| Nada na Caixa de saída como "Enviado" | `EMAIL_REAL` ou `SMTP_HOST` não foram lidos: reinicie o servidor |
