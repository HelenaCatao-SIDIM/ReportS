# Roteiro de teste: presença em autoatendimento e setores acrescentados

Para o ambiente de teste local (README, "Sem o SINC: ambiente de teste no seu computador"). Contas, todas com a senha `sidim123`:

| Conta | Papel | Serve para |
|---|---|---|
| `tecnico@teste.local` | Técnico de campo | Fazer a visita (check-in, presença, check-out) |
| `admin@teste.local` | Administrador | Cronograma, detalhe da visita e relatório |

Contratos do ambiente de teste (Prefeitura de Vale Verde):

| Sistema | Comprovação | CPF | Participantes que já existem |
|---|---|---|---|
| **SERP** | Assinatura | Exige | Luciana Ferraz, Rogério Batista |
| **SCA** | Nominal (sem assinar) | Não exige | Patrícia Gomes |

Se o contrato do seu banco estiver diferente, ajuste em Administração → Clientes → contrato do sistema.
Use dois navegadores (ou uma aba anônima) para estar logado com as duas contas. Para ver como fica no celular: `F12` e depois `Ctrl+Shift+M` (modo dispositivo).
Sem GPS no computador: `F12` → `⋮` → *More tools* → *Sensors* → *Location*, e escolha uma cidade.

## 0. Preparar os itens do cronograma (Administração)

Com `admin@teste.local`, em **Cronograma** → **Novo item**, crie três itens no contrato **Prefeitura de Vale Verde — SERP**, estabelecimento **Sede**, atividade **Treinamento**, prazo daqui a 10 dias:
setor **Protocolo**, setor **Recursos Humanos** e setor **Tributação**. Os três começam "No prazo".

Se o técnico tiver uma visita em andamento de testes anteriores, encerre-a (check-out) ou cancele-a em Administração → Visitas.

## 1. A tela de presença (contrato com assinatura e CPF: SERP)

1. Com `tecnico@teste.local`, **Novo check-in**: cliente Prefeitura de Vale Verde, sistema **SERP**, estabelecimento **Sede**, setor **Protocolo**, tipo **Treinamento**, tire a foto e **Fazer check-in**.
2. Deve abrir **"Confirme sua presença"**, e só isso: um campo de busca e o contador "0 presenças confirmadas". **Não** devem aparecer o menu do usuário nem a barra de baixo (Visita / Minhas visitas). O botão "Aguardando a primeira presença" está desabilitado.
3. Digite `luc`: aparece só **Luciana Ferraz**, sem selo, ocupação ou setor. Toque no nome.
4. Aparece "Presença de Luciana Ferraz", o campo **Seu CPF** e o quadro de assinatura. "Confirmar presença" está desabilitado.
5. Digite um CPF inválido (`123.456.789-00`), assine com o mouse e confirme: deve recusar com **"CPF inválido. Confira os números."**. Troque por um CPF válido (`529.982.247-25`) e confirme.
6. Deve aparecer **"Presença confirmada. Obrigado, Luciana!"** e, depois de 4 segundos, a busca de novo, vazia, com o contador em **1**. O nome completo da pessoa não fica na tela.
7. Digite `luc` de novo: aparece "Luciana Ferraz já assinou. Não precisa assinar de novo."
8. Digite `Fulano de Teste Silva` e toque em **Não encontrei meu nome**. O cadastro vem com o nome e o setor **Protocolo** já preenchidos; escolha uma ocupação (digite `recepcionista`), informe um CPF válido (`111.444.777-35`), assine e confirme. O contador vai a **2**.
9. No pé da tela, toque em **Todos assinaram? Continuar**: aparece uma confirmação. Toque em **Voltar** (a tela de presença continua) e depois em **Continuar** de novo para seguir.

## 2. A tela da visita: temas, anotações e setores

1. Devem aparecer, nesta ordem: temas (e equipes), **Anotações**, fotos extras, **Participantes (2)** com as duas assinaturas, **Setores atendidos** e o botão de check-out. **Não** há mais o botão "Adicionar participante": há **Voltar à tela de presença**.
2. Marque um ou dois temas.
3. Em **Anotações**, escreva algo em Observações e em Pendências. Aparece "Salvo" sozinho. Aperte `F5`: os textos continuam.
4. Em **Setores atendidos** aparece **Protocolo** marcado "check-in". Em *Acrescentar setor…*, escolha **Recursos Humanos** e toque em **Acrescentar à visita**: ele entra na lista e sai das opções.
5. Escolha **Outro (digitar)**, digite `recursos humanos` (minúsculo e sem acento) e acrescente: deve recusar ("Este setor já está na visita").
6. Digite `Almoxarifado` e acrescente: entra como "(digitado)". Retire-o pelo **X**.
7. Toque em **Voltar à tela de presença**: abre a busca de novo (chegou mais gente). Volte pelo **Continuar** do pé da tela.

## 3. Check-out

1. **Fazer check-out**. O resumo mostra **Sede · Protocolo, Recursos Humanos**, e as Observações e Pendências já vêm preenchidas com o que você anotou.
2. Capture a localização (ou use o `Sensors` do navegador) e **Confirmar check-out**.
3. A visita encerrada mostra **Setores: Protocolo, Recursos Humanos**.

## 4. Administração: cronograma, detalhe e relatório

1. Com `admin@teste.local`, em **Cronograma**: **Protocolo** e **Recursos Humanos** estão **Cumpridos** (o de Recursos Humanos foi cumprido por ter sido acrescentado à visita); **Tributação** continua "No prazo".
2. Em **Visitas**, abra a visita: **Setores: Protocolo, Recursos Humanos**.
3. **Relatórios** → **Novo relatório** (Prefeitura de Vale Verde, SERP, período que inclua hoje) → **Gerar rascunho**: a visita aparece como "Sede · Protocolo, Recursos Humanos". **Emitir e enviar** e baixe o PDF: os dois setores aparecem na lista de visitas e no quadro da visita ("Setores").

## 5. Contrato nominal (SCA)

1. Check-in de **Treinamento** no sistema **SCA**, setor **Tributação**.
2. A tela diz "Busque seu nome e **confirme**": ao tocar em **Patrícia Gomes** não há quadro de assinatura nem CPF, e "Confirmar presença" já vale.
3. Continue até a visita e faça o check-out (ou cancele a visita em Administração → Visitas).

## 6. Tipos sem participantes e reabertura

1. Check-in de **Visita técnica** (ou Reunião): abre **direto na tela da visita**, sem passar pela presença.
2. Num treinamento em que ninguém assinou ainda, saia da tela e volte por **Início → Continuar visita**: leva à tela de presença. Com alguém já assinado, leva à tela da visita.

## O que olhar com atenção

- A tela de presença não mostra dados de ninguém além do nome buscado. Se aparecer ocupação, setor, CPF ou a lista de quem já assinou, é defeito.
- Toque e teclado no celular ou tablet de verdade só dá para avaliar passando o aparelho de mão em mão: se o botão do técnico ("Todos assinaram?") for tocado sem querer, é por isso que ele pede a confirmação.
