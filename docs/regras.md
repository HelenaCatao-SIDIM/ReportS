# Regras de negócio — SIDIM Visitas

Este documento descreve as regras que o sistema aplica hoje (mockup com dados em memória), levantadas a partir do código.
O código continua sendo a fonte da verdade: cada seção indica onde a regra está implementada.
**Ao mudar uma regra no código, atualize este documento no mesmo commit.**

## Visão geral do fluxo

1. **Técnico** faz o check-in no cliente → a visita fica **em andamento** (temas, fotos extras, lista de presença).
2. **Técnico** faz o check-out → a visita fica **encerrada**.
3. **Gestor** cria o **relatório** do cliente para um período (rascunho) e o **emite**: PDF + e-mail para os aprovadores (v1).
4. **Aprovador** abre o link do e-mail e **aprova** (→ liberado para faturar) ou **pede ajuste**.
5. Se pediu ajuste, o **gestor** corrige as visitas e emite a próxima versão (v2, v3…), que volta para o passo 4.

## Perfis e acesso

| Perfil | Onde entra | Como |
|---|---|---|
| Gestor | `/admin` (Administração) | e-mail e senha |
| Técnico | `/tecnico` (App do Técnico) | e-mail e senha |
| Aprovador do cliente | `/aprovacao/<token>` | link pessoal do e-mail, sem login |

- O e-mail do login não diferencia maiúsculas de minúsculas. Usuário **inativo** não entra.
- A sessão dura **12 horas** (JWT assinado com `SESSION_SECRET`, em cookie httpOnly).
- Além do cookie, as páginas e as ações conferem se o usuário existe, está ativo e tem o perfil certo. Usuário inativado perde o acesso mesmo com a sessão ainda válida.
- Quem tenta abrir a área do outro perfil é levado para a própria página inicial.

Onde: `src/proxy.ts` (checagem rápida do cookie), `src/lib/dal.ts` (checagem completa), `src/lib/session.ts`, `src/app/actions/auth.ts`.

## Cadastros (gestor)

### Usuários

- Nome com pelo menos 3 caracteres, e-mail válido e **único**, senha com pelo menos **6** caracteres (obrigatória só na criação; na edição, em branco mantém a atual).
- O gestor **não pode inativar a própria conta nem mudar o próprio perfil**.
- Não há exclusão: o usuário é inativado.

Onde: `src/app/admin/usuarios/actions.ts`, `src/lib/repo/usuarios.ts`.

### Clientes

- Nome (pelo menos 2 caracteres), **CNPJ válido** (dígitos verificadores) e **único**, e **contrato** (texto que aparece na capa do relatório).
- **Nível de comprovação** da presença:
  - **Nominal** — a lista de presença tem só os dados das pessoas;
  - **Assinada** — cada pessoa assina no celular do técnico (só em visitas presenciais; veja [Lista de presença](#lista-de-presença)).
- **Exige CPF** dos participantes: sim ou não.
- Pelo menos **um aprovador**, cada um com nome e e-mail válido, sem e-mail repetido no mesmo cliente. Linhas totalmente vazias são ignoradas.
- Cliente **inativo** não aparece no check-in. Cliente sem nenhuma unidade também não.

Onde: `src/app/admin/clientes/actions.ts`, `src/lib/repo/clientes.ts`.

### Unidades e setores

- Unidade: nome obrigatório e endereço. Latitude (−90 a 90) e longitude (−180 a 180) são opcionais e, nesta versão, **apenas guardadas**: o sistema não compara a localização do check-in com a da unidade.
- Setor: nome obrigatório, sem repetir dentro da unidade (sem diferenciar acentos e maiúsculas).
- Remover uma unidade remove os setores dela. Hoje a remoção **não é bloqueada** quando há visitas registradas (o bloqueio está previsto para a fase de banco).

Onde: `src/app/admin/clientes/actions.ts`, `src/lib/repo/clientes.ts`.

### Temas

- Um tema é a combinação **nome + sistema + módulo**, todos obrigatórios, e a combinação não pode se repetir (sem diferenciar acentos e maiúsculas).
- Se o sistema ou o módulo digitado só difere de um já cadastrado em acento ou maiúsculas, o sistema usa a grafia já existente ("gestao de pessoas" → "Gestão de Pessoas").
- Não há exclusão: o tema é **inativado**. Tema inativo não aparece para o técnico, mas continua nas visitas em que já estava marcado.

Onde: `src/app/admin/temas/actions.ts`, `src/lib/repo/temas.ts`.

### Participantes

- Pertencem a um cliente. Obrigatórios: nome (pelo menos 3 caracteres), cargo, **ocupação CBO** escolhida da tabela e setor.
- **CPF** só quando o cliente exige: precisa ser válido e único no cliente. Quando o cliente não exige, o CPF não é guardado.
- **Homônimo**: se já existe alguém com o mesmo nome no cliente, o sistema pede a confirmação de que é outra pessoa (na edição, só se o nome mudou).
- Participantes cadastrados pelo técnico durante uma visita ficam marcados como **"criado em campo"**.

Onde: `src/app/admin/participantes/actions.ts`, `src/lib/repo/participantes.ts`.

### Tabela CBO

- Busca pelo título (sem acento) ou pelo código; o código tem 6 dígitos e é exibido como `4110-10`.
- Hoje é uma **amostra provisória de 25 ocupações**, com códigos não conferidos. Falta importar a tabela oficial do Ministério do Trabalho.

Onde: `src/lib/repo/cbo.ts`.

## Visitas (App do Técnico)

### Tipos de visita

| Tipo | Presencial | Exige participante no check-out |
|---|---|---|
| Treinamento | sim | **sim** |
| Implantação | sim | não |
| Suporte presencial | sim | não |
| Reunião | sim | não |
| Visita técnica | sim | não |
| Treinamento online | não | **sim** |

Onde: `src/lib/visitas.ts` (`TIPOS_VISITA`), `src/lib/regras-visita.ts` (`exigeParticipantes`).

### Check-in

- O técnico só pode ter **uma visita em andamento** por vez.
- Escolhe, em cascata: cliente (ativo) → unidade → setor (da lista da unidade ou "outro", digitado) → tipo.
- **Presencial**: exige a **localização do celular** e a **foto do ambiente**.
- **Online**: exige o **print da tela da reunião** e o **link da reunião** (começando com `http://` ou `https://`).
- A hora de entrada é a **hora do servidor**, nunca a do celular.
- A localização é lida uma única vez, no check-in e no check-out (alta precisão, espera de até 20 s). Não há rastreamento contínuo. O navegador só libera o GPS em `https` ou `localhost`.

Onde: `src/app/tecnico/actions.ts`, `src/components/tecnico/use-gps.ts`, `src/lib/repo/visitas.ts` (`abrirVisita`).

### Durante a visita

Só o próprio técnico altera a visita, e só enquanto ela está em andamento:

- **Temas**: marca os temas ativos (ou os que já estavam marcados);
- **Tema adicional**: texto livre de até 300 caracteres;
- **Fotos extras**: adiciona e remove.

Onde: `src/app/tecnico/visita/actions.ts`.

### Lista de presença

- O técnico busca a pessoa no cadastro do cliente: as sugestões aparecem a partir de 2 letras, até 8 nomes, com o CPF mascarado. Pessoas que já estão na lista não aparecem.
- Se a pessoa não está cadastrada, o técnico a cadastra ali mesmo, com as mesmas validações do cadastro do gestor. Ela entra no cadastro do cliente como "criado em campo".
- A mesma pessoa não entra duas vezes na lista.
- **Assinatura** é exigida quando o cliente é **Assinada** e a visita é **presencial**. Treinamento online é sempre nominal.
- A presença guarda uma **cópia** dos dados da pessoa naquele momento (nome, cargo, CBO, setor e CPF). Mudanças posteriores no cadastro não alteram visitas já registradas.

Onde: `src/app/tecnico/visita/participantes-actions.ts`.

### Check-out

- Treinamento e treinamento online: exigem **pelo menos um participante** na lista.
- Presencial: exige a **localização do celular**.
- Observações, pendências e próximos passos são opcionais, com até 4.000 caracteres cada.
- A hora de saída é a **hora do servidor**. Depois do check-out, o técnico **não altera mais** a visita.
- O que o técnico digita no check-out fica salvo como rascunho no celular (`localStorage`) até a visita ser encerrada.

Onde: `src/app/tecnico/visita/checkout-actions.ts`, `src/app/tecnico/visita/[id]/checkout/checkout-form.tsx`.

### Histórico do técnico

O técnico vê só as próprias visitas, filtradas por período: este mês, mês passado, últimos 90 dias ou datas escolhidas.

Onde: `src/app/tecnico/visitas/page.tsx`.

## Gestão de visitas (gestor)

### Visitas em andamento

Aparecem da mais antiga para a mais recente, para que as esquecidas fiquem no topo. O gestor pode:

- **Encerrar** uma visita que o técnico esqueceu aberta: informa a data e a hora da saída (depois da entrada e não no futuro) e uma justificativa (pelo menos 5 caracteres). A visita fica marcada como **"encerrada pelo gestor"**.
- **Cancelar** um check-in feito por engano, com justificativa (pelo menos 5 caracteres). Visita cancelada **nunca entra em relatório**.

### Correção de visita encerrada

- Campos que o gestor pode corrigir: entrada, saída (depois da entrada e não no futuro), tipo, unidade (do mesmo cliente), setor, temas, tema adicional, observações, pendências e próximos passos. Também pode **retirar** participantes da lista e fotos extras.
- Cliente, técnico, localizações, foto do ambiente e print não mudam.
- O **motivo** é obrigatório (pelo menos 5 caracteres). Se nada mudou, nada é gravado.
- Visita em **relatório aprovado** fica **travada**: ninguém altera.

### Histórico de alterações

Toda ação do gestor numa visita (encerramento, cancelamento ou correção) fica registrada com autor, data e hora, motivo e cada campo alterado (antes → depois).

### CPF

O CPF completo aparece **só para o gestor**, na tela de detalhe da visita. Nos demais lugares (PDF, página do aprovador, sugestões do técnico) aparece mascarado: `***.456.789-**`.

Onde: `src/app/admin/visitas/actions.ts`, `src/lib/repo/visitas.ts`, `src/components/visita/detalhe-visita.tsx`.

## Relatórios

### Status

| Status | Exibido como | Significado |
|---|---|---|
| `rascunho` | Rascunho | criado, ainda não emitido |
| `enviado` | Enviado | versão emitida, aguardando a decisão do cliente |
| `ajuste_solicitado` | Ajuste solicitado | o aprovador pediu correção; o gestor emite nova versão |
| `aprovado` | **Liberado para faturar** | aprovado; relatório e visitas travados |

### Rascunho

- O gestor escolhe o cliente e o período (data inicial e final, inclusive, no horário de Brasília), em geral um mês.
- O período **não pode cruzar** o de outro relatório do mesmo cliente.
- Entram as visitas **encerradas** do cliente com entrada até o fim do período e que **não estão em outro relatório**. Isso inclui visitas de períodos anteriores que ficaram de fora, marcadas como **"Período anterior"**.
- Sem nenhuma visita, o rascunho não é criado.
- As visitas ficam **reservadas** para o relatório e não entram em outro.
- **Atualizar visitas** recalcula a lista (ex.: uma visita esquecida foi encerrada depois). Vale para rascunho e ajuste solicitado.
- **Excluir** só vale para rascunho nunca emitido e libera as visitas.
- O relatório soma as **horas presenciais** e as **horas online** separadamente (saída − entrada de cada visita).

### Emissão

- Só pode emitir um relatório em rascunho ou com ajuste solicitado, com pelo menos uma visita, e o cliente precisa ter aprovadores.
- Cada emissão cria uma **versão** (v1, v2, …) com o conteúdo **congelado**: o PDF e a página do aprovador mostram exatamente o que foi emitido. Correções feitas depois não mudam uma versão já emitida.
- O **PDF** traz os CPFs mascarados. Fotos e assinaturas entram no PDF quando são PNG ou JPEG; WebP fica de fora.
- Cada aprovador recebe um **e-mail** com o **link pessoal** ("Ver relatório"). O PDF vai **anexo até 8 MB**; acima disso, o e-mail leva só o link, e o PDF é baixado pela página.
- O status passa a **Enviado** e os links da versão anterior deixam de valer.

### Aprovação pelo cliente

- Há **um link por aprovador e por versão**, sem login.
- **Basta a decisão de um aprovador** e vale a primeira: os links dos demais aprovadores daquela versão param de aceitar decisão, e eles recebem um e-mail avisando quem decidiu.
- **Aprovar** → status **Liberado para faturar**; as visitas ficam travadas.
- **Pedir ajuste** → motivo obrigatório (de 10 a 2.000 caracteres) → status **Ajuste solicitado**. O gestor corrige as visitas, atualiza a lista se precisar e emite a próxima versão.
- A partir da v2, a página do aprovador mostra **o que mudou** em relação à versão anterior.
- Um link já decidido ou de versão substituída continua abrindo **só para consulta**.
- Pelo link, o aprovador só baixa os arquivos que fazem parte da versão daquele link (PDF, fotos e assinaturas).
- O gestor não recebe e-mail: acompanha pelo status no sistema.

> Uma visita de relatório **Enviado** ainda pode ser corrigida pelo gestor, mas a versão enviada não muda. A correção só aparece na próxima versão, que só pode ser emitida depois de um pedido de ajuste.

Onde: `src/lib/repo/relatorios.ts`, `src/lib/emissao.tsx`, `src/app/admin/relatorios/actions.ts`, `src/app/aprovacao/[token]/`.

## Datas e horas

- O sistema guarda tudo em UTC (ISO) e exibe no **horário de Brasília** (−03:00 fixo; não há horário de verão desde 2019).
- Entrada e saída registradas pelo técnico usam o relógio do servidor. Datas e horas digitadas pelo gestor são lidas no horário de Brasília.

Onde: `src/lib/datas.ts`.

## Fotos e arquivos

- O celular comprime cada foto antes de enviar: lado maior de até 1.600 px e cerca de 500 KB em JPEG.
- O servidor aceita JPEG, PNG e WebP com até **1,5 MB** por arquivo. Cada envio de formulário tem limite de 4 MB.
- Arquivos do sistema (`/arquivos/<id>`) só abrem para usuários logados.

Onde: `src/lib/imagem.ts`, `src/lib/repo/arquivos.ts`, `src/app/arquivos/[id]/route.ts`, `next.config.ts`.

## Ainda não implementado

- A localização do check-in não é comparada com a da unidade.
- Remover unidade ou setor com visitas registradas não é bloqueado.
- A tabela CBO é uma amostra.
- Dados, fotos e PDFs ficam em memória, e os e-mails só aparecem em **Administração → Caixa de saída (teste)**.
