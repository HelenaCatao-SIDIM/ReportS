# Fluxo do n8n: resumo de chamados por cliente

Arquivo para importar: `docs/n8n-resumo-chamados.json` (nome no n8n: **Reports Sidim - Resumo de chamados por cliente**).
Ele **não altera** o fluxo de captura que já existe ("SIDIM - Suporte (Reset + Relatório + Captura)"): só lê a tabela `atendimentos`.

## Importar

1. No n8n: **Workflows → ⋯ → Import from File** e escolha `docs/n8n-resumo-chamados.json`.
2. Nó **Webhook**: o fluxo **não usa chave nem credencial** (*Authentication: None*). Como o endereço é a única proteção, troque o **Path** por um texto longo e aleatório (ex.: `resumo-chamados-` e mais 32 letras e números, que você pode gerar com `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`) e **não divulgue o endereço**: quem o souber consulta os chamados de qualquer cliente. Se puder, restrinja também por rede, para só o servidor do ReportS chamar o webhook.
3. Nó **Ler atendimentos**: confira se a tabela escolhida é **atendimentos** (o arquivo já aponta para ela; se o n8n pedir, escolha de novo na lista).
4. Nó **Montar resumo**: confira a constante `FUSO_DATAS` (abaixo).
5. Salve e **ative** o fluxo. A URL de produção fica em `https://<seu-n8n>/webhook/resumo-chamados-cliente` → vai no ReportS, em Administração → Configurações (campo "Endereço do webhook"); o botão **Salvar e testar** confere o endereço.

## Como funciona

```
Webhook (POST) → Validar entrada → Entrada válida?
   ├─ sim → Ler atendimentos → Montar resumo → Responder resumo (200)
   └─ não → Responder erro (400)
```

Pedido:

```json
{ "clientes": ["Prefeitura de Vale Verde / Vale Verde"], "inicio": "2026-10-01", "fim": "2026-10-31", "incluirLista": true, "sistema": "SERP" }
```

- `clientes`: 1 a 10 nomes, exatamente como no campo Cliente / Município dos atendimentos (o mesmo nome do cliente no SINC). A comparação ignora acentos, maiúsculas e espaços extras.
- `inicio`/`fim`: datas AAAA-MM-DD (horário de Brasília), inclusive, no máximo 12 meses.
- `sistema` (**opcional**): o nome do sistema como o Fortics grava no campo **sistema** da tabela `atendimentos`. Com ele, o fluxo conta só os chamados desse sistema (mesma comparação sem acento, maiúsculas e espaços extras); sem ele, conta todos os sistemas do cliente, como antes. O Reports manda o **"Nome no Fortics" do sistema do contrato do relatório**, cadastrado no SINC em Configurações > Sistemas. Sistema sem esse nome cadastrado vai sem o campo (e a Administração vê o aviso no bloco de chamados). Texto de até 120 caracteres; outro tipo dá erro 400.
- Conta o chamado quando a `data_abertura` está no período. Toda linha da tabela já é um chamado encerrado.

Resposta: `sistema` (o filtro usado, ou `null`), `totalAbertosEFechados`, `porSistema`, `porTopico`, `porMotivoEncerramento`, `tempoMedioEsperaMin` e `chamados`
(protocolo, abertura, encerramento, sistema, tópico, motivo, atendente). **Nunca** devolve a transcrição nem as avaliações das IAs.

## Fuso das datas (`FUSO_DATAS`)

Conferido em 26/10/2026 na tabela `atendimentos`: a `data_abertura` é gravada como `2026-10-26T14:53:34.000000Z`,
mas os horários vão das 07h às 17h e o último chamado bate com o horário de Brasília. Ou seja, o `Z` do final **não**
é UTC de verdade. Por isso o padrão é `FUSO_DATAS = 'brasilia'`, que usa a data como está gravada.
Troque para `'utc'` só se o capturador passar a gravar o horário UTC real.

## Quais valores o campo sistema tem (conferir antes de cadastrar)

O filtro só acerta se o "Nome no Fortics" do sistema for igual ao valor que o Fortics grava no campo **sistema**. **Esses valores ainda
não foram conferidos.** Antes de preencher o "Nome no Fortics" em Configurações > Sistemas do SINC, veja os valores distintos da coluna
`sistema` da tabela `atendimentos` (por exemplo, numa execução manual com um nó que lê a tabela e agrupa por `sistema`). Se o
Fortics grava mais de uma forma para o mesmo sistema (ex.: `SERP` e `Gestão Tributária`), o filtro por um nome só perde os chamados da
outra forma: neste caso, é preciso decidir com quem mantém o fluxo se `sistema` passa a aceitar uma lista.

Os nomes no campo Cliente / Município são texto livre e variam (ex.: `Mariana` e `mariana`; acentos e maiúsculas
já são ignorados). Quando o mesmo cliente aparece de formas diferentes, cadastre cada forma em "Nome no SINC".

## Testar antes de ligar no Reports

Com o fluxo aberto, clique em **Test workflow** e chame a URL de teste:

```bash
curl -s -X POST "https://<seu-n8n>/webhook-test/<path do webhook>" \
  -H "Content-Type: application/json" \
  -d '{"clientes":["<nome de um cliente no SINC>"],"inicio":"2026-10-01","fim":"2026-10-31"}'
```

| Caso | Esperado |
|---|---|
| Cliente com chamados | `totalAbertosEFechados` maior que 0 e a lista |
| Cliente sem chamados | `totalAbertosEFechados: 0`, sem erro |
| `"inicio":"2026-10-31","fim":"2026-10-01"` | status 400 com `erro` |
| `"sistema":"SERP"` | só os chamados com sistema SERP (sem acento, maiúsculas e espaços extras), e `"sistema":"SERP"` na resposta |
| Sem `sistema` | todos os sistemas do cliente, e `"sistema":null` na resposta |
| `"sistema":123` | status 400 com `erro` |

Se a tabela ficar muito grande, troque a leitura "Return All" por um filtro na própria consulta.
