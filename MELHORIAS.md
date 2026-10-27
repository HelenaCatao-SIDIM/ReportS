# Melhorias e sugestões — SIDIM Visitas

Registro de alterações futuras e sugestões. O `README.md` continua sendo a referência de como rodar o sistema e da situação atual; aqui fica o que ainda **vamos fazer** ou **queremos avaliar**.

## Como usar

- Um item por linha: `- [ ]` pendente, `- [x]` feito.
- Informe a prioridade (**Alta**, **Média** ou **Baixa**) e, quando souber, a origem da sugestão.
- Ao concluir, marque o item e mova para **Concluído** com a data e o commit.
- Decisões que mudam regra de negócio devem ser anotadas no próprio item, para não se perderem.

## Definições da próxima versão

Registradas em 26/10/2026. Legenda: ✅ definido · ⚠ ponto de atenção · *Evolutiva* = entra numa versão seguinte · *Fora desta versão* = só entra quando a função existir. Onde aparece **Hoje no código**, é o que foi conferido no repositório no momento do registro.

- **1. Sistema da operação, não de uma pessoa.** O sistema tem três papéis — Gestor, Técnico e Aprovador — e qualquer pessoa pode ocupar qualquer um deles. Pode existir mais de um gestor, e a coordenação pode mudar de mão sem que nada quebre: nenhum cadastro, relatório ou fluxo tem nome de pessoa escrito dentro. O mesmo vale para o que é configurável (clientes, unidades, setores, temas): fica em cadastro, não no código.
- ✅ **2. Cargo sai, fica só o CBO** (Classificação Brasileira de Ocupações). **Feito para o participante em 26/10/2026 (`63d3dd4`).**
   - Removido de `Participante` e `PresencaVisita`, do cadastro e da edição na Administração, do cadastro em campo e da lista no App do Técnico, do detalhe e da correção de visita e da tabela do PDF do relatório. A busca de participantes passa a ser por nome, ocupação ou setor.
   - **Ficou como estava, a decidir:** o cargo do **aprovador** (`Aprovador` e `aprovadorCargo` em `src/lib/types.ts`, cadastro do cliente e relatório). A decisão vale também para ele? (ver "Para alinhar com o time")
- ✅ **3. Setor do participante: opcional,** já preenchido com o setor da visita. **Feito em 27/10/2026 (`226ac59`).**
   - No cadastro de novo participante em campo (App do Técnico), o campo já vem com o setor da visita e pode ser apagado. Na Administração, o setor deixou de ser obrigatório. Sem setor, as tabelas e o PDF mostram "—".
   - **Ficou como estava, a decidir:** participante já cadastrado, escolhido pela busca, mantém o setor do próprio cadastro; se esse setor estiver vazio, a presença também fica sem setor (não herda o da visita).
- **4. Lista de presença por seleção: evolutiva.** Nesta versão o técnico digita os participantes. Quando a base de pessoas do cliente estiver disponível, passa a ser seleção. **É o primeiro item a alinhar com o time de desenvolvimento.**
- **5. Coordenadas da unidade sem digitação, com solução gratuita.** Converter endereço em coordenadas por serviço aberto. Isso acerta a rua, não a porta — então o ponto fica ajustável, e a posição do primeiro check-in pode refinar a referência da unidade.
   - **Hoje no código:** latitude e longitude da unidade são digitadas à mão (`Unidade` em `src/lib/types.ts`).
- ⚠ **6. Raio da unidade: alerta, não bloqueio.** O raio de 300 m foi questionado, mas 20–30 m é apertado demais: o GPS (Sistema de Posicionamento Global) do celular erra de 5 a 20 metros em rua aberta e bem mais dentro de prédio, e UPA e hospital são justamente onde o sinal é pior. Com 25 m, o técnico que está lá dentro geraria alerta quase sempre, e alerta que toca sempre ninguém olha.
   - **Sugestão:** começar em 50 m e gravar a distância medida em cada check-in. Em dois meses o número real permite apertar o raio com dado, não com palpite. O raio é por unidade, então a que for problemática se ajusta sozinha.
   - **Hoje no código:** não há raio nem cálculo de distância; o raio por unidade e o registro da distância medida são funções novas.
- **7 e 8. Marcação de implantação e check-list: fora desta versão.** Entram quando a função existir.
- **9. Aviso de visita aberta por WhatsApp, via Fortics.** O número virá do cadastro do técnico (o campo ainda não existe; ver abaixo). O e-mail fica como reserva. O sistema continua nunca encerrando a visita sozinho.
   - **Dúvida para o time:** o Fortics expõe API (Interface de Programação de Aplicações) para disparo? Se expuser, é o melhor canal. Notificação do próprio navegador é alternativa, mas falha no iPhone e não é confiável.
   - **Hoje no código:** o `Usuario` (`src/lib/types.ts`) **não tem campo de telefone**; ele precisa ser incluído no cadastro do técnico.
- **10. Registro pelo celular e pelo computador, com o meio identificado.** O técnico registra pelos dois, e a visita grava por onde foi feita, aparecendo no relatório. No computador, aviso em tela quando o tipo for presencial. Modo específico de treinamento online fica como *evolutiva*.
- **11. Nada se perde, com rascunho local.** Cada item é salvo no servidor quando registrado, e o que está sendo digitado fica guardado no próprio aparelho — aba aberta, celular travado ou bateria no fim, o técnico volta e encontra tudo como estava.
- ✅ **12. "Liberado para faturar" passa a "Aprovado".** **Feito em 26/10/2026 (`805693d`).**
  - O rótulo está em `src/lib/visitas.ts` e aparece no selo de status, na lista e no detalhe do relatório (Administração).
  - **Ficou como estava, a decidir:** a mensagem ao aprovador na página de aprovação (`src/app/aprovacao/[token]/decisao.tsx`: "A aprovação libera o faturamento dos serviços…"), a frase do README ("que libera o faturamento") e o cabeçalho "Status / faturamento" da lista de relatórios. Falam do faturamento como conceito, não do rótulo.

### Para alinhar com o time de desenvolvimento

- [ ] **Primeiro** — Base de pessoas do cliente, para a lista de presença passar de digitação a seleção (definição 4).
- [ ] O Fortics expõe API para disparo de WhatsApp? (definição 9)
- [ ] A remoção do cargo vale também para o aprovador? (definição 2)

## A fazer

### Infraestrutura (vem do "Próximos passos" do README)

- [ ] **Alta** — Banco de dados real (Prisma + PostgreSQL/Supabase). A troca fica concentrada em `src/lib/repo/*`; as telas não mudam.
- [ ] **Alta** — Armazenamento de fotos, assinaturas e PDFs (Supabase Storage). Hoje ficam em memória.
- [ ] **Média** — Envio real de e-mail (Resend) com o domínio da SIDIM. Hoje é simulado e aparece em Administração → Caixa de saída (teste); ponto de troca em `src/lib/email.ts`.
- [ ] **Média** — Importar a tabela CBO oficial do Ministério do Trabalho. Hoje é uma amostra de 25 ocupações, com códigos não conferidos. Ganha peso com a definição 2, em que o CBO passa a ser o único campo de ocupação.
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
