# Teste do envio real de e-mail (Resend)

Sem `EMAIL_REAL=true` e `RESEND_API_KEY`, nada muda: os e-mails só aparecem em **Administração → Caixa de saída**.
O Resend é o provedor padrão e tem plano gratuito (confira o limite atual no site). O SMTP fica como alternativa, no fim deste roteiro.

## 1. Preparar o Resend (uma vez)

1. Crie uma conta em https://resend.com. Para o teste, **use o seu e-mail** (pessoal ou o da SIDIM): é nele que os e-mails chegam,
   e não precisa de domínio. Confirme o e-mail que o Resend enviar.
2. **API Keys → Create API Key**, permissão **Sending access**. Copie a chave (ela só aparece uma vez). **Não cole no chat nem no Git.**
3. No `.env.local`, com cada variável em uma linha própria:

```
EMAIL_REAL=true
RESEND_API_KEY=<a chave>
EMAIL_REDIRECIONAR_PARA=<o e-mail da conta do Resend>
```

Sem `EMAIL_REMETENTE`, o sistema usa `onboarding@resend.dev`, o remetente de testes do Resend, que **só entrega ao e-mail dono da
conta**. Por isso a trava `EMAIL_REDIRECIONAR_PARA` aponta para esse mesmo e-mail.

4. Reinicie o `npm run dev`.

## 2. Primeiro envio real

1. Entre como `gestor@sidim.com.br`, gere um relatório (ex.: Prefeitura de Vale Verde, 01/10 a 31/10) e clique em **Emitir e enviar**.
2. A página avisa "e-mail enviado a 2 de 2 aprovador(es)". Na **Caixa de saída**, cada e-mail aparece como **Enviado**, com o
   identificador do Resend e o aviso da trava de teste. No painel do Resend (**Emails**) aparecem os mesmos envios.
3. Abra a caixa de entrada (e o spam). Devem chegar dois e-mails, com assunto `[TESTE → Nome <e-mail do aprovador>] Relatório de
   atendimento SIDIM …`, o **PDF em anexo** e o botão **Ver relatório**.
4. Clique no botão: abre a página do aprovador com o link pessoal daquele aprovador. Aprove. O outro aprovador é avisado por e-mail
   (que também chega a você, pela trava).

Os aprovadores **não precisam de conta nenhuma**: recebem um e-mail comum.

## 3. Enviar aos aprovadores de verdade

1. No Resend: **Domains → Add Domain** (ex.: `sidimsistemas.com.br` ou um subdomínio como `relatorios.sidimsistemas.com.br`) e peça a
   quem cuida do DNS para criar os registros que ele mostrar (SPF e DKIM). Espere o domínio ficar **Verified**.
2. No `.env.local`: `EMAIL_REMETENTE=SIDIM Relatórios <relatorios@<domínio verificado>>`.
3. Ajuste `APP_URL` para o endereço público do sistema (https), para o link abrir fora do seu computador.
4. **Só então** remova `EMAIL_REDIRECIONAR_PARA` e reinicie. A partir daí os e-mails vão aos aprovadores cadastrados.

## O que conferir quando algo falha

| Sintoma na Caixa de saída | Causa provável |
|---|---|
| "O Resend respondeu 403/422 … domain is not verified" | Remetente de um domínio ainda não verificado, ou destinatário que não é o dono da conta usando `onboarding@resend.dev` |
| "O Resend respondeu 401" | Chave errada, revogada ou com espaço sobrando |
| "O Resend respondeu 429" | Limite de envios do plano; o sistema já tenta uma segunda vez |
| Página: "O envio falhou para N aprovador(es)" | O relatório está emitido e os links existem; corrija a causa e emita uma nova versão |
| Nada na Caixa de saída como "Enviado" | `EMAIL_REAL` ou `RESEND_API_KEY` não foram lidos: reinicie o servidor |

## Alternativa: SMTP (Gmail, Microsoft 365 ou o e-mail da SIDIM)

No `.env.local`, em vez da chave do Resend:

```
EMAIL_REAL=true
EMAIL_PROVEDOR=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORTA=465
SMTP_USUARIO=seu-email@gmail.com
SMTP_SENHA=<senha de app do Gmail>
EMAIL_REDIRECIONAR_PARA=seu-email@gmail.com
```

No Gmail, a senha é uma **senha de app** (Verificação em duas etapas ligada → Segurança → Senhas de app). No Google Workspace é o
mesmo servidor; no Microsoft 365, `smtp.office365.com`, porta 587, e a TI precisa liberar o envio por SMTP da caixa. Gmail e Microsoft 365
só aceitam o próprio endereço da conta como remetente. Erros comuns: "recusou o usuário ou a senha" (senha comum no lugar da senha de app)
e "Não foi possível falar com o servidor SMTP" (servidor, porta ou firewall).
