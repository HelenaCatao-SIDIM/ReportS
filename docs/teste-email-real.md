# Teste do envio real de e-mail (Resend)

Sem `EMAIL_REAL=true` e `RESEND_API_KEY`, nada muda: os e-mails só aparecem em **Administração → Caixa de saída**.

## 1. Preparar o Resend (uma vez)

1. Crie uma conta em https://resend.com. Para o teste, **pode ser o seu e-mail pessoal**: é nele que os e-mails chegam, e não precisa de domínio. (Com dados de clientes de verdade, prefira um e-mail da SIDIM.)
2. **API Keys → Create API Key**, permissão **Sending access**. Copie a chave (ela só aparece uma vez).
3. No `.env.local` (nunca no Git), com cada variável em uma linha própria:

```
EMAIL_REAL=true
RESEND_API_KEY=<a chave>
EMAIL_REDIRECIONAR_PARA=<o e-mail da conta do Resend>
```

Sem `EMAIL_REMETENTE`, o sistema usa `onboarding@resend.dev`, o remetente de testes do Resend, que **só entrega ao e-mail do dono
da conta**. Por isso a trava `EMAIL_REDIRECIONAR_PARA` aponta para esse mesmo e-mail.

4. Reinicie o `npm run dev`.

## 2. Primeiro envio real

1. Entre como `gestor@sidim.com.br`, gere um relatório (ex.: Prefeitura de Vale Verde, 01/10 a 31/10) e clique em **Emitir e enviar**.
2. A página avisa "e-mail enviado a 2 de 2 aprovador(es)". Na **Caixa de saída**, cada e-mail aparece como **Enviado**, com o
   identificador do Resend e o aviso da trava de teste.
3. Abra a caixa de entrada (e o spam). Devem chegar dois e-mails, com assunto `[TESTE → Nome <e-mail do aprovador>] Relatório de
   atendimento SIDIM …`, o **PDF em anexo** e o botão **Ver relatório**.
4. Clique no botão: abre a página do aprovador com o link pessoal daquele aprovador. Aprove. O outro aprovador é avisado por e-mail
   (que também chega a você, pela trava).

## 3. Enviar aos aprovadores de verdade

1. No Resend: **Domains → Add Domain** (ex.: `sidimsistemas.com.br` ou um subdomínio como `relatorios.sidimsistemas.com.br`) e crie no
   DNS os registros que ele mostrar (SPF e DKIM). Espere o domínio ficar **Verified**.
2. No `.env.local`: `EMAIL_REMETENTE=SIDIM Relatórios <relatorios@<domínio verificado>>`.
3. Ajuste `APP_URL` para o endereço público do sistema (https), para o link abrir fora do seu computador.
4. **Só então** remova `EMAIL_REDIRECIONAR_PARA` e reinicie. A partir daí os e-mails vão aos aprovadores cadastrados.

## O que conferir quando algo falha

| Sintoma | Causa provável |
|---|---|
| Caixa de saída: "Resend respondeu 403/422 … domain is not verified" | Remetente de um domínio ainda não verificado, ou destinatário que não é o dono da conta com `onboarding@resend.dev` |
| "Resend respondeu 401" | Chave errada, revogada ou com espaço sobrando |
| "Resend respondeu 429" | Limite de envios do plano; o sistema já tenta uma segunda vez |
| Página: "O envio falhou para N aprovador(es)" | O relatório está emitido e os links existem; corrija a causa e emita uma nova versão |
| Nada na Caixa de saída como "Enviado" | `EMAIL_REAL` ou `RESEND_API_KEY` não foram lidos: reinicie o servidor |
