# Fluxo do n8n: resumo de chamados por cliente

Arquivo para importar: `docs/n8n-resumo-chamados.json` (nome no n8n: **Reports Sidim - Resumo de chamados por cliente**).
Ele **não altera** o fluxo de captura que já existe ("SIDIM - Suporte (Reset + Relatório + Captura)"): só lê a tabela `atendimentos`.

## Importar

1. No n8n: **Workflows → ⋯ → Import from File** e escolha `docs/n8n-resumo-chamados.json`.
2. Nó **Webhook**, em *Credential for Header Auth* → **Create new credential**:
   - Name: `x-api-key`
   - Value: uma chave longa e aleatória (ex.: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   Salve como **Chave Reports Sidim**. A mesma chave vai em `N8N_RESUMO_CHAMADOS_CHAVE` no `.env.local` do Reports.
3. Nó **Ler atendimentos**: confira se a tabela escolhida é **atendimentos** (o arquivo já aponta para ela; se o n8n pedir, escolha de novo na lista).
4. Nó **Montar resumo**: confira a constante `FUSO_DATAS` (abaixo).
5. Salve e **ative** o fluxo. A URL de produção fica em `https://<seu-n8n>/webhook/resumo-chamados-cliente` → vai em `N8N_RESUMO_CHAMADOS_URL`.

## Como funciona

```
Webhook (POST, Header Auth) → Validar entrada → Entrada válida?
   ├─ sim → Ler atendimentos → Montar resumo → Responder resumo (200)
   └─ não → Responder erro (400)
```

Pedido:

```json
{ "clientes": ["Prefeitura de Vale Verde / Vale Verde"], "inicio": "2026-10-01", "fim": "2026-10-31", "incluirLista": true }
```

- `clientes`: 1 a 10 nomes, exatamente como no campo Cliente / Município do Fortics. A comparação ignora acentos, maiúsculas e espaços extras.
- `inicio`/`fim`: datas AAAA-MM-DD (horário de Brasília), inclusive, no máximo 12 meses.
- Conta o chamado quando a `data_abertura` está no período. Toda linha da tabela já é um chamado encerrado.

Resposta: `totalAbertosEFechados`, `porSistema`, `porTopico`, `porMotivoEncerramento`, `tempoMedioEsperaMin` e `chamados`
(protocolo, abertura, encerramento, sistema, tópico, motivo, atendente). **Nunca** devolve a transcrição nem as avaliações das IAs.

## Fuso das datas (`FUSO_DATAS`)

Conferido em 26/10/2026 na tabela `atendimentos`: a `data_abertura` é gravada como `2026-10-26T14:53:34.000000Z`,
mas os horários vão das 07h às 17h e o último chamado bate com o horário de Brasília. Ou seja, o `Z` do final **não**
é UTC de verdade. Por isso o padrão é `FUSO_DATAS = 'brasilia'`, que usa a data como está gravada.
Troque para `'utc'` só se o capturador passar a gravar o horário UTC real.

Os nomes no campo Cliente / Município são texto livre e variam (ex.: `Mariana` e `mariana`; acentos e maiúsculas
já são ignorados). Quando o mesmo cliente aparece de formas diferentes, cadastre cada forma em "Nome no Fortics".

## Testar antes de ligar no Reports

Com o fluxo aberto, clique em **Test workflow** e chame a URL de teste:

```bash
curl -s -X POST "https://<seu-n8n>/webhook-test/resumo-chamados-cliente" \
  -H "Content-Type: application/json" -H "x-api-key: <chave>" \
  -d '{"clientes":["<nome de um cliente no Fortics>"],"inicio":"2026-10-01","fim":"2026-10-31"}'
```

| Caso | Esperado |
|---|---|
| Cliente com chamados | `totalAbertosEFechados` maior que 0 e a lista |
| Cliente sem chamados | `totalAbertosEFechados: 0`, sem erro |
| `"inicio":"2026-10-31","fim":"2026-10-01"` | status 400 com `erro` |
| Sem o cabeçalho `x-api-key` | recusado (403) |

Se a tabela ficar muito grande, troque a leitura "Return All" por um filtro na própria consulta.
