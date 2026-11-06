# Publicação: cronograma de implantação, presença em autoatendimento e setores

Passo a passo para quem tem acesso ao servidor do ReportS (usuário `reports`, em `/var/www/reports`). O `bin/deploy` leva para produção **tudo o que está na `main`** desde a última publicação, não só o cronograma. Visão geral da publicação: README, "Publicação".

O que esta publicação traz:
- **Cronograma de implantação:** a tabela nova `cronograma_itens` (migração `*_cronograma`), as telas na Administração, no App do Técnico e no relatório ao cliente, e a importação por planilha do Excel. Regras: `docs/regras.md`, "Cronograma de implantação". Roteiro: `docs/teste-cronograma.md`.
- **Presença em autoatendimento e setores acrescentados à visita:** a tela em que os próprios participantes buscam o nome e assinam, as anotações durante a visita e os setores acrescentados até o check-out. Duas migrações que **só acrescentam** (a tabela `visita_setores` e a coluna `presencas.validacao`). Regras: `docs/regras.md`, "Lista de presença" e "Durante a visita". Roteiro: `docs/teste-presenca-setores.md`.
- **Login do participante no Saúde (na tela de presença):** o código sobe **desligado**. Para ligar, depois do deploy e da conferência, veja a seção "Ligar o login do participante no Saúde" abaixo. Sem `SAUDE_LOGIN_PARTICIPANTE=true` nada muda para o usuário.

## 1. Antes de rodar (2 minutos)

```bash
cd /var/www/reports
git status --short                      # tem que vir vazio (alteração local trava o git pull)
git fetch origin main
git log --oneline HEAD..origin/main     # é o que vai subir
sudo -u postgres psql reports_production -c "\dt equipes"
```

- O `git log` deve listar o merge do cronograma (`538fe88`). Se listar também as PRs de Equipes (18 e 19), elas sobem juntas.
- O `\dt equipes` diz se Equipes já está em produção. Se responder "Did not find any relation", este deploy também cria a tabela e as telas de Equipes: avise a Helena.
- Backup, de preferência: `sudo -u postgres pg_dump -Fc reports_production > ~/reports_antes_cronograma.dump`. A migração só cria uma tabela nova, mas o dump é barato. Ele contém dados pessoais (CPF): guarde com permissão restrita e apague depois.

## 2. Deploy

```bash
bin/deploy
```

O que deve aparecer, em ordem:

1. `git pull`, `npm ci` (instala `read-excel-file` e `write-excel-file`), a conferência da estrutura da plataforma e o `build`.
2. Em "migrações do banco reports": `20261103145715_cronograma`, `20261104130000_visita_setores`, `20261104190000_presenca_validacao` e `20261105150000_configuracoes` (a tabela das configurações editadas na Administração) `20261105190000_remove_chave_n8n` (apaga a chave do n8n que uma versão anterior pode ter guardado) e `20261105210000_relatorio_atendimentos` (a coluna do tipo de relatório de atendimentos no contrato, com padrão sintético). Se Equipes ainda não estava no ar, aparece também `20261103220617_equipes` (todas funcionam em qualquer ordem e só acrescentam tabela ou coluna).
3. `deploy finalizado`, com o `reports-web` ativo (running).

**Se parar em "estrutura do banco plataforma confere?":** o SINC mudou uma tabela que o ReportS lê. O app antigo continua no ar. Rode `npm run db:plataforma:ler`, revise o `git diff` de `prisma/plataforma/schema.prisma` e avise o time de desenvolvimento antes de mexer em qualquer outra coisa.

## 3. Conferir no servidor

```bash
sudo systemctl status reports-web --no-pager --lines 5
curl -sI https://reports.sidim.com.br/login | head -1     # esperado: 200
```

## 4. Conferir no navegador (conta Administrador)

1. Administração → **Cronograma** abre, vazio.
2. **Importar planilha** → **Baixar o modelo** baixa um `.xlsx`.
3. Envie uma planilha pequena, de 2 ou 3 linhas, de um cliente real, e confira o resumo antes de confirmar. **Isso grava dado de verdade em produção**: combine com a Helena qual cliente usar.
4. Confirme e veja os itens em **Cronograma**. Estabelecimento novo criado pela importação aparece em **Clientes**, só com o nome (sem endereço nem coordenadas).
5. (Opcional) No App do Técnico, faça o check-in no estabelecimento que tem item: a tela mostra o que ainda falta ali.
6. **Presença e setores (App do Técnico, de preferência no celular):** faça o check-in de um **Treinamento** de teste. Depois do check-in deve abrir **"Confirme sua presença"**, só com a busca e o contador, **sem menu e sem barra de baixo**. Busque um nome, assine (ou confirme, se o contrato é nominal) e toque em **Todos assinaram? Continuar**. Na tela da visita confira **Anotações** (salvam sozinhas) e **Setores atendidos** (acrescente um setor). Termine com o check-out, ou cancele a visita de teste em Administração → Visitas. Roteiro completo: `docs/teste-presenca-setores.md`.

## 5. Permissões

O Administrador já vê tudo. Para os outros papéis, no SINC:

| Permissão | Para quê |
|---|---|
| `reports.contratos.gerenciar` | Criar, editar, cancelar e **importar** itens do cronograma |
| `reports.visitas.gerenciar` | Só ver o cronograma |
| `reports.clientes.cadastrar` | Além da primeira: cadastrar estabelecimento ou setor novo pela importação (sem ela, só dá para alterar para um existente) |

O `permissoes:registrar` do deploy atualiza a descrição das permissões `contratos` e `visitas`; não cria permissão nova.

## 6. Configuração

Nada novo é **obrigatório**: não há variável de ambiente nova para o deploy. O limite de upload do nginx no modelo do repositório (`deploy/nginx-reports.conf`) é 6 MB, e a planilha tem teto de 2 MB. Se o envio do arquivo falhar no servidor, confira se o `client_max_body_size` do nginx de lá é de pelo menos 3 MB.

### Ligar o login do participante no Saúde (opcional, depois do deploy)

Uma chave liga para **todos os clientes do Saúde** que estiverem no diretório de servidores do Saúde. Ligue só **depois** de conferir o resto da publicação.

1. **Confira o certificado a partir do servidor** (o Node, que é o que o ReportS usa, não completa sozinho a cadeia de certificados como o navegador faz). Não envia usuário nem senha:
   ```bash
   node -e "fetch('https://sidim.no-ip.net/servidores_saude/api/servidorsaude').then(async r=>console.log(r.status, (await r.json()).length, 'servidores')).catch(e=>console.log('ERRO', e.cause?.code||e.message))"
   node -e "fetch('https://sidim.no-ip.net/api_parademinas/api/login',{method:'POST'}).then(async r=>console.log(r.status, await r.text())).catch(e=>console.log('ERRO', e.cause?.code||e.message))"
   ```
   Esperado: `200 22 servidores` (o número pode mudar) e `400 {"error":"invalid_grant"...}`. Se aparecer `ERRO UNABLE_TO_VERIFY_LEAF_SIGNATURE` (ou parecido), o certificado não está completo para o Node: peça ao time do Saúde para incluir o certificado intermediário. **Não** desligue a verificação.
2. No `.env.local` do servidor (dono `reports`, modo 600), acrescente **só** esta linha (a senha de cada pessoa nunca vai para o arquivo, e não há linha por cliente):
   ```
   SAUDE_LOGIN_PARTICIPANTE=true
   ```
   Reinicie: `sudo systemctl restart reports-web`.
3. Condições para aparecer na tela: o sistema **Saúde** do cliente precisa ter um tenant (vem do SINC) igual ao **nome da pasta da logo** dele no diretório (ex.: `saude_parademinas` para `.../saude_parademinas/Imagens/Logo_Prefeitura.png`), e o participante precisa ter o **id do Saúde** (`external_user_id`) igual ao `userId` do login. Cliente que o diretório não encontra continua com a presença de antes. Atenção: cliente que está no diretório, mas com a API fora do ar, passa a pedir o login e mostra "Não foi possível falar com o Saúde agora"; o técnico usa o modo sem login.
4. Teste com **uma pessoa de verdade**, em um treinamento de teste: busque o nome, entre com o usuário e a senha dela e assine. Se a pessoa certa for recusada ("este usuário não é o da pessoa escolhida"), o `userId` do login pode ser diferente do id guardado no participante: avise o time de desenvolvimento. Roteiro: `docs/teste-presenca-setores.md`, seção 7.
5. Para desligar a qualquer momento: remova a linha `SAUDE_LOGIN_PARTICIPANTE` (ou troque por `false`) e reinicie. A presença volta a ser só busca e assinatura.

## 7. Se algo der errado

A migração só adiciona a tabela `cronograma_itens` e não altera nada existente, então o código antigo roda com ela no banco.

- **Voltar a versão:** reverta o merge na `main` (pelo GitHub) e rode `bin/deploy` de novo. O deploy sempre publica o que está na `main`; não use `git reset` no servidor.
- **Item importado por engano:** cancele em Cronograma.
- **Estabelecimento ou setor criado sem querer:** remova em Clientes, depois de cancelar os itens dele (item ativo impede a remoção).
