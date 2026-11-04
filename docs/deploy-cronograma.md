# Publicação do cronograma de implantação (PR #20)

Passo a passo para quem tem acesso ao servidor do ReportS (usuário `reports`, em `/var/www/reports`). O `bin/deploy` leva para produção **tudo o que está na `main`** desde a última publicação, não só o cronograma. Visão geral da publicação: README, "Publicação".

O que esta publicação traz: a tabela nova `cronograma_itens` (migração `*_cronograma`), as telas do cronograma na Administração, no App do Técnico e no relatório ao cliente, e a importação por planilha do Excel. Regras: `docs/regras.md`, seção "Cronograma de implantação". Roteiro de teste: `docs/teste-cronograma.md`.

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
2. Em "migrações do banco reports": `Applying migration 20261103145715_cronograma`. Se Equipes ainda não estava no ar, aparece também `20261103220617_equipes` (as duas funcionam em qualquer ordem).
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

## 5. Permissões

O Administrador já vê tudo. Para os outros papéis, no SINC:

| Permissão | Para quê |
|---|---|
| `reports.contratos.gerenciar` | Criar, editar, cancelar e **importar** itens do cronograma |
| `reports.visitas.gerenciar` | Só ver o cronograma |
| `reports.clientes.cadastrar` | Além da primeira: cadastrar estabelecimento ou setor novo pela importação (sem ela, só dá para alterar para um existente) |

O `permissoes:registrar` do deploy atualiza a descrição das permissões `contratos` e `visitas`; não cria permissão nova.

## 6. Configuração

Nada novo: não há variável de ambiente nova. O limite de upload do nginx no modelo do repositório (`deploy/nginx-reports.conf`) é 6 MB, e a planilha tem teto de 2 MB. Se o envio do arquivo falhar no servidor, confira se o `client_max_body_size` do nginx de lá é de pelo menos 3 MB.

## 7. Se algo der errado

A migração só adiciona a tabela `cronograma_itens` e não altera nada existente, então o código antigo roda com ela no banco.

- **Voltar a versão:** reverta o merge na `main` (pelo GitHub) e rode `bin/deploy` de novo. O deploy sempre publica o que está na `main`; não use `git reset` no servidor.
- **Item importado por engano:** cancele em Cronograma.
- **Estabelecimento ou setor criado sem querer:** remova em Clientes, depois de cancelar os itens dele (item ativo impede a remoção).
