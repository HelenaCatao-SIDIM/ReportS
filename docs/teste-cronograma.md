# Roteiro de teste: cronograma de implantação

Para o ambiente de teste local (README, "Sem o SINC: ambiente de teste no seu computador"). Contas, todas com a senha `sidim123`:

| Conta | Papel | Serve para |
|---|---|---|
| `admin@teste.local` | Administrador | Administração e App do Técnico |
| `coord@teste.local` | Coordenação (só visitas) | Ver o cronograma sem editar |
| `tecnico@teste.local` | Técnico de campo | Só o App do Técnico |

Use o cliente **Prefeitura de Vale Verde**, sistema **SCA** (contrato nominal, sem CPF): é o mais simples para uma visita completa.
Use abas anônimas ou dois navegadores para estar logado com duas contas ao mesmo tempo.

## 1. Cadastrar os itens (Administração)

1. Entre com `admin@teste.local` e abra **Cronograma** no menu. A tela começa vazia, com os quatro contadores em 0.
2. **Novo item** → clique em **Criar item** sem preencher nada: devem aparecer os erros do contrato, do estabelecimento e do prazo.
3. Crie três itens, sempre no contrato **Prefeitura de Vale Verde — SCA** e no estabelecimento **Sede**:

   | Setor | Atividade | Prazo | Esperado |
   |---|---|---|---|
   | Protocolo | Treinamento | daqui a 10 dias | No prazo, "faltam 10 dias" |
   | Recursos Humanos | Treinamento | ontem | Atrasado, "venceu há 1 dia" |
   | Todos os setores | Implantação | daqui a 3 dias | A vencer, "faltam 3 dias" |

   Na observação do primeiro, escreva algo como "Combinado com o secretário" (ela é interna).
4. Tente criar o primeiro de novo: deve recusar ("Já existe um item ativo igual").
5. Confira: a lista vem do mais urgente ao menos urgente, e os contadores mostram 1 atrasado, 1 a vencer, 1 no prazo e 0 cumpridos.
6. Teste **Editar** (o contrato fica travado), **Cancelar** (o item sai da lista; aparece no filtro "Cancelados") e **Reativar**.

## 2. O técnico vê o que falta (App do Técnico)

1. Com `tecnico@teste.local`, em **Novo check-in**, escolha o cliente **Prefeitura de Vale Verde** e o sistema **SCA**. O estabelecimento **Sede** já vem escolhido.
2. Deve aparecer o quadro **"Cronograma: o que falta neste estabelecimento"** com os três itens e **sem** a observação interna.
3. Escolha o setor **Protocolo**: o item do Protocolo e o de "Todos os setores" ganham destaque ("este é o setor da visita").

## 3. Cumprimento automático pela visita

1. Escolha o tipo **Treinamento**, permita a localização (ou use um navegador sem GPS e escolha outro caminho), tire uma foto e faça o check-in.
2. O check-in de treinamento abre a **tela de presença** (só busca e assinatura, sem menu). Digite um nome que não existe, toque em **Não encontrei meu nome**, escolha a ocupação e **Confirmar presença**. Toque em **Todos assinaram? Continuar** e **Continuar**: abre a tela da visita (temas, anotações, setores). Faça o **check-out**.
3. Volte ao check-in: o item do **Protocolo** não aparece mais entre as pendências.
4. Na Administração → Cronograma: o item do Protocolo está **Cumprido, em <hoje>**; o de Implantação continua **A vencer** (a visita foi de Treinamento, não de Implantação). Contadores: 1 atrasado, 1 a vencer, 0 no prazo, 1 cumprido.

## 4. O relatório ao cliente

1. Administração → **Relatórios** → **Novo relatório**: cliente Prefeitura de Vale Verde, sistema SCA, período que inclua hoje → **Gerar rascunho**.
2. O rascunho mostra o cartão **Cronograma de implantação**: "1 de 3 itens cumpridos · 1 atrasado". A observação interna **não** aparece.
3. **Emitir e enviar** (sem SMTP configurado, o e-mail só aparece em **Caixa de saída**). Baixe o PDF: o cronograma está na primeira página.
4. Na Caixa de saída, abra o link **Ver relatório** (pode ser em aba anônima): a página do aprovador mostra o mesmo cronograma.
5. Volte ao cronograma e **mude o prazo** do item de Recursos Humanos para daqui a 30 dias. O relatório emitido e a página do aprovador **continuam** mostrando o item como atrasado: o que o cliente recebeu não muda.

## 5. Permissões

1. Com `coord@teste.local`: **Cronograma** abre, mas sem "Novo item", "Editar" nem "Cancelar".
2. Com `tecnico@teste.local`, abrir `/admin/cronograma` volta para o App do Técnico.

## 6. Importar o cronograma por planilha

1. Em **Cronograma**, clique em **Importar planilha** e depois em **Baixar o modelo**. Abra o arquivo no Excel: a primeira aba tem o cabeçalho e dois exemplos; a segunda explica as colunas.
2. Preencha algumas linhas com o cliente **Prefeitura de Vale Verde** e o sistema **SCA**. Misture de propósito:
   - uma linha certa (estabelecimento **Sede**, setor **Protocolo**);
   - uma com um **estabelecimento que não existe** (por exemplo, "Posto Norte") e um setor novo;
   - uma com um **setor que não existe** na Sede (por exemplo, "Arquivo Geral");
   - uma com **erro de digitação** no estabelecimento ("Sedee");
   - uma **repetida**, e uma com a atividade ou o prazo inválido (por exemplo, "Churrasco" e "amanhã");
   - uma com um **cliente que não existe**.
   Salve como `.xlsx`.
3. **Escolha o arquivo** e clique em **Analisar planilha**. A tela abre no **Item 1 de N**: só entram na fila as linhas com pergunta ou erro (as certas e as repetidas entram sozinhas). Os pontos coloridos no topo mostram o estado de cada item.
4. Em cada item, o primeiro campo que falta aparece sozinho; **os seguintes só aparecem depois que você resolve o atual**:
   - estabelecimento ou setor que não existe: **Cadastrar “…”** ou **Alterar para um existente** (a sugestão "parecido" vem primeiro). Mude de ideia pelo menos uma vez: a resposta continua na tela, e os campos seguintes somem e voltam conforme a resposta;
   - cliente que não existe: escolha um contrato, ou **Pular este item**;
   - atividade inválida: escolha a atividade; só então aparece o prazo, que você corrige;
   - estabelecimento em branco: a tela diz que só se corrige na planilha, e a saída é **Pular este item**.
5. **Próximo** só libera com o item resolvido. Se duas linhas usam o mesmo nome que não existe, responder uma resolve a outra: o **Próximo** pula direto o item já resolvido (use **Anterior** para vê-lo).
6. No fim vem o **Resumo da importação**: leia os contadores e **"O que vai acontecer"**, abra **"Ver todas as linhas da planilha"** (as linhas que já estavam certas só aparecem ali) e clique em **Confirmar importação**. Nada foi gravado até aqui. Se faltar algo, o resumo mostra o botão **Ir ao primeiro item pendente**.
7. Abra **Cronograma**: os itens estão lá. O estabelecimento novo foi criado só com o nome (veja em **Clientes**: falta o endereço e as coordenadas).
8. **Importe a mesma planilha de novo**: o que já existe entra como "Ignorada" ("Já existe no cronograma") e some da fila, e nada é duplicado.
9. Com `coord@teste.local` (só visitas), o botão **Importar planilha** não aparece.

## Para recomeçar do zero

Apague os dois bancos, crie de novo e repita os comandos do README (`db:migrate`, `db:ambiente-teste`, `db:exemplo`):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\dropdb.exe" -U postgres reports_development
& "C:\Program Files\PostgreSQL\16\bin\dropdb.exe" -U postgres plataforma_development
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres -O reports reports_development
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres -O reports plataforma_development
```
