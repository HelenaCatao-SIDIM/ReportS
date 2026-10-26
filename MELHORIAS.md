# Melhorias e sugestões — SIDIM Visitas

Registro de alterações futuras e sugestões. O `README.md` continua sendo a referência de como rodar o sistema e da situação atual; aqui fica o que ainda **vamos fazer** ou **queremos avaliar**.

## Como usar

- Um item por linha: `- [ ]` pendente, `- [x]` feito.
- Informe a prioridade (**Alta**, **Média** ou **Baixa**) e, quando souber, a origem da sugestão.
- Ao concluir, marque o item e mova para **Concluído** com a data e o commit.
- Decisões que mudam regra de negócio devem ser anotadas no próprio item, para não se perderem.

## A fazer

### Infraestrutura (vem do "Próximos passos" do README)

- [ ] **Alta** — Banco de dados real (Prisma + PostgreSQL/Supabase). A troca fica concentrada em `src/lib/repo/*`; as telas não mudam.
- [ ] **Alta** — Armazenamento de fotos, assinaturas e PDFs (Supabase Storage). Hoje ficam em memória.
- [ ] **Média** — Envio real de e-mail (Resend) com o domínio da SIDIM. Hoje é simulado e aparece em Administração → Caixa de saída (teste); ponto de troca em `src/lib/email.ts`.
- [ ] **Média** — Importar a tabela CBO oficial do Ministério do Trabalho. Hoje é uma amostra de 25 ocupações, com códigos não conferidos.
- [ ] **Média** — Publicar (Vercel) e testar no celular com https. O GPS do check-in presencial só funciona em https ou em `localhost`.

### Documentação

- [ ] **Média** — Corrigir o comando do `.env.local` no README. O comando atual usa `>`, que no PowerShell do Windows grava o arquivo em UTF-16; o Next.js não lê, a chave de sessão fica vazia e o login quebra. Comando que funciona em qualquer terminal:

  ```bash
  node -e "require('fs').writeFileSync('.env.local', 'SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64') + '\nAPP_URL=http://localhost:3000\n')"
  ```

- [ ] **Média** — Trazer para o repositório o "guia" de regras de negócio que o README cita. Ele não está no repositório hoje.

### Qualidade

- [ ] **Média** — Testar o fluxo completo de ponta a ponta: check-in → check-out → emissão do relatório → aprovação pelo cliente.
  - Já verificado: login de gestor, técnico e técnico inativo (recusado); telas iniciais de Administração e Técnico sem erros de JavaScript.
  - Ainda não verificado: check-in e check-out, emissão do relatório, página de aprovação.

## Sugestões a avaliar

- [ ] **Baixa** — Acesso pelo GitHub Codespaces (navegador, com https). **Não testado.** O login usa Server Action, e a documentação do Next.js 16 indica que acesso por túnel ou proxy pode exigir `allowedOrigins` (em `experimental.serverActions`) e `allowedDevOrigins` no `next.config.ts`, liberando `*.app.github.dev`. Avaliar também um `devcontainer`. Em Codespaces, o `APP_URL` precisa ser o endereço público, senão os links de aprovação apontam para `localhost`.
- [ ] **Baixa** — Padronizar a versão do npm da equipe. O `npm install` com npm 10.9 remove campos `libc` do `package-lock.json`, gerando um diff sem significado. Enquanto não padronizar, não commitar esse diff.

## Concluído

- [x] Mockup completo das três interfaces (Administração, App do Técnico e Aprovação), com dados em memória — `745a349`.
- [x] README com como rodar, acessos de teste e situação atual — `c085435`.
