# Teste da localização por CEP

Pré-requisito: no `.env.local`, `LOCALIZACAO_POR_CEP=true`, `CARIMBO_FOTO=true` e `GEOCODING_USER_AGENT` com um e-mail
de contato. Pare e rode `npm run dev` de novo depois de mudar o `.env.local`.

> O GPS só funciona em **https** ou em `localhost`. No celular, use Codespaces, um túnel (ex.: `npx localtunnel --port 3000`)
> ou a publicação na Vercel. No computador, `http://localhost:3000` funciona (o navegador pede a localização).

## 1. Conferência rápida no computador

1. `npm run lint` e `npm run build` sem erros.
2. Entre como `ana@sidim.com.br` (senha `sidim123`). Ela tem uma visita aberta: no cabeçalho aparece
   "Localização registrada" (visita de exemplo, sem CEP) e, ao recarregar a página alguns segundos depois, o **CEP**
   (a coordenada de exemplo fica em Campinas/SP).
3. Faça o check-out dessa visita. Na tela de check-out, a linha da localização mostra **"CEP … (aproximado) · aprox. … m"**, nunca a coordenada.
4. Volte ao início e faça um check-in presencial:
   - ao escolher um tipo presencial, a localização é pedida e aparece "Identificando o CEP…" e depois o CEP;
   - tire a foto do ambiente: com `CARIMBO_FOTO=true`, a prévia mostra a faixa com data/hora e CEP;
   - confirme o check-in.
5. Entre como `gestor@sidim.com.br`, abra a visita em **Visitas**: "Local do check-in" mostra CEP (aproximado) + endereço + precisão ("Precisão: aprox. … m").
6. **Relatórios → Novo relatório** → emita → **Caixa de saída** → **Ver relatório** (página do aprovador):
   as visitas mostram CEP, sem coordenadas.
7. Desligue `LOCALIZACAO_POR_CEP` e reinicie: tudo volta a mostrar a coordenada, como antes.

## 2. No celular (https)

| Caso | Esperado |
|---|---|
| Check-in numa capital | CEP da rua, sempre marcado "aproximado" (a localização nunca é apresentada como exata, como no WhatsApp) |
| Check-in numa cidade pequena | CEP geral da cidade, marcado "aproximado" |
| Localização negada | Mesma mensagem de sempre, com "Tentar de novo"; check-in bloqueado |
| GPS fraco (dentro de prédio) | Precisão baixa (ex.: aprox. 80 m), CEP pode sair aproximado |
| Servidor sem internet / APIs fora do ar | Check-in funciona; aparece "Endereço indisponível no momento"; ao abrir a visita mais tarde, o CEP é buscado de novo |
| Correção pelo gestor | O local (CEP, precisão) não muda |
| Treinamento online | Nada de GPS nem CEP |

## 3. O que conferir em todas as telas

Com `LOCALIZACAO_POR_CEP=true`, **nenhuma** destas telas mostra latitude/longitude:
check-in, check-out, cabeçalho da visita em andamento, detalhe da visita (técnico e gestor), página do relatório,
versões e página do aprovador. O PDF não mostra local (como antes).
