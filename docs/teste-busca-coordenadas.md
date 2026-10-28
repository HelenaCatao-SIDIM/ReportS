# Teste da busca de coordenadas pelo endereço

Pré-requisitos: `BUSCA_COORDENADAS=true` e `GEOCODING_USER_AGENT` com um contato real da SIDIM no `.env.local`.
Reinicie o `npm run dev` depois de mudar o `.env.local`.

1. `npm run lint` e `npm run build` sem erros.
2. Com `BUSCA_COORDENADAS` desligada: o cadastro do estabelecimento fica como antes, sem o botão.
3. Entre como `gestor@sidim.com.br`. **Clientes → Clínica Bem Viver → Editar** o estabelecimento **Matriz** (sem coordenadas).
4. Troque o endereço por um **real, com número, cidade e UF** (ex.: o do estabelecimento) e clique em **Buscar coordenadas pelo endereço**:
   - latitude e longitude são preenchidas;
   - a mensagem mostra o endereço que o mapa achou ("Encontrado: …"); confira a cidade e a rua;
   - **Ver no mapa** abre o ponto; confira se cai no lugar certo.
5. Ajuste a latitude à mão e clique em **Salvar**. Reabra o estabelecimento: os valores salvos aparecem.
6. Digite um endereço que não existe: aparece "Endereço não encontrado" e os campos não mudam.
7. Faça um check-in presencial nesse estabelecimento: o detalhe da visita (gestor) mostra a distância e "Dentro do raio" ou "Fora do raio".

Limites: a busca acerta a rua, não a porta (a distância tem essa folga); no máximo 10 buscas por minuto por gestor e
1 consulta por segundo ao Nominatim; repetir o mesmo endereço usa o resultado guardado.
