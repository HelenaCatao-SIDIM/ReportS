# Teste do envio real de e-mail

Sem `EMAIL_REAL=true` e o SMTP configurado, nada muda: os e-mails só aparecem em **Administração → Caixa de saída**.
O caminho da SIDIM é o **SMTP da própria empresa** (Oracle Cloud Email Delivery). O SMTP do Gmail fica como alternativa para teste, no fim. (O envio pelo Resend, dos primeiros testes, foi retirado em 30/10/2026: decisão D-04 do plano.)

## 1. Com o SMTP da SIDIM

Peça à equipe responsável (a mesma que configura os outros sistemas) os dados do SMTP: servidor, usuário, senha e o remetente aprovado.
**Esses dados são segredos: não cole no chat nem no Git.**

1. No `.env.local` (cada variável em uma linha própria):

```
EMAIL_REAL=true
SMTP_HOST=smtp.email.<região>.oci.oraclecloud.com
SMTP_PORTA=587
SMTP_USUARIO=<usuário SMTP do OCI>
SMTP_SENHA=<senha SMTP do OCI>
EMAIL_REMETENTE=Sidim Sistemas <remetente aprovado no OCI>
EMAIL_REDIRECIONAR_PARA=<o seu e-mail, para receber os testes>
```

   O `EMAIL_REMETENTE` é obrigatório: o usuário do OCI não é um e-mail, e o remetente precisa estar aprovado lá. Não defina `SMTP_SEGURO`.
2. Reinicie o `npm run dev`.
3. Entre como `gestor@sidim.com.br`, gere um relatório (ex.: Prefeitura de Vale Verde, 01/10 a 31/10) e clique em **Emitir e enviar**.
4. A página avisa "e-mail enviado a 2 de 2 aprovador(es)". Na **Caixa de saída**, cada e-mail aparece como **Enviado**, com o
   identificador da mensagem e o aviso da trava de teste.
5. Abra a caixa de entrada **e o spam**. Devem chegar dois e-mails, com assunto `[TESTE → Nome <e-mail do aprovador>] Relatório de
   atendimento SIDIM …`, o **PDF em anexo** e o botão **Ver relatório**.
6. Clique no botão: abre a página do aprovador com o link pessoal daquele aprovador. Aprove. O outro aprovador é avisado por e-mail
   (que também chega a você, pela trava).

Com `EMAIL_REDIRECIONAR_PARA` definida, **nada** vai para os aprovadores de verdade. Os aprovadores não precisam de conta nenhuma.

## 2. Enviar aos aprovadores de verdade

1. Confirme com a equipe do e-mail que o remetente está aprovado e que o domínio dele tem SPF e DKIM (sem isso, os e-mails podem cair no spam).
2. Ajuste `APP_URL` para o endereço público do sistema (https), para o link abrir fora do seu computador.
3. **Só então** remova `EMAIL_REDIRECIONAR_PARA` e reinicie. A partir daí os e-mails vão aos aprovadores cadastrados.

## O que conferir quando algo falha

| Sintoma na Caixa de saída | Causa provável |
|---|---|
| "O servidor SMTP recusou o usuário ou a senha" | Usuário ou senha errados, copiados com espaço, ou credencial revogada |
| "O servidor SMTP não oferece conexão criptografada (STARTTLS)" | Servidor ou porta errados (use 587 com STARTTLS, ou 465). Por segurança, usuário e senha não foram enviados |
| "Não foi possível falar com o servidor SMTP: tempo esgotado…" (ETIMEDOUT) | A rede, o firewall ou o antivírus está bloqueando a porta 587. Teste no PowerShell: `Test-NetConnection smtp.email.sa-saopaulo-1.oci.oraclecloud.com -Port 587` (precisa mostrar `TcpTestSucceeded : True`). Se der `False`, tente outra rede (ex.: o celular como roteador) ou peça à TI para liberar a saída na porta 587 |
| "…conexão recusada" (ECONNREFUSED) | Servidor ou porta errados |
| "…o endereço do servidor não foi encontrado" (ENOTFOUND) | `SMTP_HOST` errado ou sem internet/DNS |
| "…falha na conexão segura (TLS): certificado… `self-signed certificate in certificate chain`" | A conexão chegou ao servidor, mas algo no caminho (antivírus com verificação de conexões criptografadas, ou o firewall/proxy da empresa) troca o certificado por um próprio, que o Node não reconhece. O Windows confia nele; o Node não. Nenhuma senha foi enviada. Solução: `$env:NODE_OPTIONS="--use-system-ca"` antes de `npm run dev` (Node 22.15 ou mais novo), ou `$env:NODE_EXTRA_CA_CERTS="C:\caminho\certificado-da-empresa.pem"` com o certificado raiz que a TI fornecer. **Nunca** use `NODE_TLS_REJECT_UNAUTHORIZED=0`: isso desliga a verificação e expõe a senha |
| "…falha na conexão segura (TLS)" (outros) | Data/hora do computador errada, ou protocolo/certificado não aceitos |
| "O servidor SMTP recusou a mensagem (5xx …)" | Remetente não aprovado no OCI, destinatário inexistente ou política do servidor |
| "O servidor SMTP respondeu 4xx" | Limite de envios ou problema temporário; o sistema já tenta uma segunda vez |
| Página: "O envio falhou para N aprovador(es)" | O relatório está emitido e os links existem; corrija a causa e emita uma nova versão |
| Nada na Caixa de saída como "Enviado" | `EMAIL_REAL` ou `SMTP_HOST` não foram lidos: reinicie o servidor |

## Alternativa: Gmail (só para teste)

```
EMAIL_REAL=true
SMTP_HOST=smtp.gmail.com
SMTP_PORTA=465
SMTP_USUARIO=seu-email@gmail.com
SMTP_SENHA=<senha de app do Gmail>
EMAIL_REDIRECIONAR_PARA=seu-email@gmail.com
```

A senha é uma **senha de app** (Verificação em duas etapas ligada → Segurança → Senhas de app).
