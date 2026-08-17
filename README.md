# TicketDev: Desafio Elite Dev 2026

[![CI](https://github.com/luizfernandosb/desafio-elite-dev/actions/workflows/ci.yml/badge.svg)](https://github.com/luizfernandosb/desafio-elite-dev/actions/workflows/ci.yml)

Plataforma de eventos e ingressos construída para o Desafio Elite Dev da Verzel. Um organizador
publica sessões a partir de um catálogo de filmes vindo do TMDb, o cliente escolhe assento num
mapa de cinema, paga (de forma simulada ou, se quiser testar, via Stripe em modo de teste), recebe
um ingresso com QR code não forjável e pode compartilhá-lo por link. Na entrada, a portaria valida
o ingresso lendo o QR pela câmera ou digitando o código manualmente.

Este documento cobre, nesta ordem: como testar a aplicação já publicada, como rodar tudo
localmente, o que foi pedido no desafio e o que foi implementado, o que foi feito além do pedido,
as limitações conhecidas, os dados de teste já semeados, um resumo das decisões técnicas por área
e como rodar a suíte de testes.

## Sumário

1. [Stack](#stack)
2. [Testar online](#testar-online)
3. [Rodar localmente](#rodar-localmente)
4. [O que foi pedido e o que foi implementado](#o-que-foi-pedido-e-o-que-foi-implementado)
5. [Implementado além do pedido](#implementado-além-do-pedido)
6. [Fora de escopo, de propósito](#fora-de-escopo-de-propósito)
7. [Limitações conhecidas](#limitações-conhecidas)
8. [Dados de teste](#dados-de-teste)
9. [Decisões técnicas por área](#decisões-técnicas-por-área)
10. [Testes e CI](#testes-e-ci)
11. [Uso de IA no processo](#uso-de-ia-no-processo)

---

## Stack

### Back-end

- Node.js com TypeScript, servidor Express 5
- Prisma 7 (com driver adapter para PostgreSQL) como ORM
- Zod para validação de entrada em toda rota
- JWT (`jsonwebtoken`) para autenticação, `argon2` para hash de senha
- `google-auth-library` para verificar o login social
- Stripe (modo de teste) como provedor real de pagamento, atrás da flag de teste do checkout
- Supabase Storage para upload de imagem do evento
- Pino para log estruturado, Helmet, `cors` e `express-rate-limit` para segurança e limite de taxa
- Multer e `file-type` para receber e validar upload de arquivo pelos bytes reais do conteúdo
- Vitest para testes, ESLint e Prettier para lint e formatação

### Front-end

- React 19 com Vite, TypeScript
- React Router para rotas, TanStack Query para estado de servidor e cache
- React Hook Form com Zod para formulários
- Radix UI como base sem estilo para os componentes de interface
- Stripe.js e React Stripe.js (Elements) para o formulário de cartão real
- Supabase JS para o mapa de assentos em tempo real
- `@zxing/browser` para leitura de QR pela câmera, `qrcode.react` para gerar o QR do ingresso
- Vitest, Testing Library, jsdom, MSW e `vitest-axe` para testes (unitários, de componente e de
  acessibilidade), oxlint para lint

### Banco de dados e infraestrutura

- PostgreSQL 16, local via Docker Compose e gerenciado pelo Supabase em produção
- Supabase também para Storage e para o canal de tempo real do mapa de assentos
- Render para o deploy do back-end, Vercel para o deploy do front-end
- GitHub Actions para integração contínua

### Serviços externos

- TMDb, como catálogo de filmes
- Stripe, em modo de teste, como provedor real de pagamento
- Google Identity Services, para o login social

## Testar online

A aplicação está publicada e no ar:

- Front-end (Vercel): https://desafio-elite-dev-seven.vercel.app
- Back-end (Render): https://desafio-elite-dev-iqdx.onrender.com (`/health` responde `{"status":"ok","db":"up"}`)

O banco já está semeado com um organizador, dois clientes, um usuário de portaria e três sessões
(duas publicadas, uma em rascunho), então dá para percorrer o fluxo inteiro sem montar nada do
zero. As credenciais estão na seção [Dados de teste](#dados-de-teste) mais abaixo.

Um detalhe sobre a hospedagem gratuita: o back-end no Render entra em repouso depois de um
período sem tráfego, e a primeira requisição depois disso pode levar de trinta segundos a um
minuto para responder enquanto a instância acorda. Isso não é um bug, é o comportamento normal do
plano gratuito.

## Rodar localmente

### Pré-requisitos

- Node.js 22 ou mais recente (os dois `package.json`, front e back, declaram `engines.node: ">=22"`;
  versões anteriores quebram em pelo menos duas dependências que exigem APIs do Node 22, `jsdom`
  nos testes de front e `@supabase/supabase-js` no upload de imagem)
- Docker (para o Postgres local via `docker compose`)
- npm (o projeto usa `package-lock.json`, não `yarn.lock` nem `pnpm-lock.yaml`)

### Passo a passo

Clone o repositório e entre nele:

```bash
git clone https://github.com/luizfernandosb/desafio-elite-dev.git
cd desafio-elite-dev
```

Suba o Postgres local (cria automaticamente o banco de desenvolvimento `ticketdev` e o de teste
`ticketdev_test`):

```bash
docker compose up -d db
```

Instale as dependências dos dois projetos:

```bash
cd backend && npm install
cd ../frontend && npm install
```

Copie os arquivos de exemplo de variáveis de ambiente:

```bash
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.example .env
```

Os valores padrão do `backend/.env.example` já apontam para o Postgres local do `docker compose`
(usuário e senha `postgres`, banco `ticketdev`) e passam na validação de schema mesmo sem
credenciais reais de Stripe, Supabase, TMDb ou Google. Isso significa que o back-end sobe e a
maior parte do fluxo funciona só com os valores de exemplo, com estas ressalvas:

- sem uma chave real do TMDb (`TMDB_API_KEY`), o organizador não consegue buscar filmes ao criar
  uma sessão nova (os filmes já semeados continuam aparecendo normalmente)
- sem uma chave real do Stripe (`STRIPE_SECRET_KEY`), o pagamento simulado (padrão da aplicação)
  funciona sem nenhuma configuração extra; só a opção de testar o Stripe de verdade (ver
  [Pedidos e pagamento](#pedidos-e-pagamento) mais abaixo) exige uma chave de teste real
- sem Supabase configurado, o upload de imagem/banner de evento não funciona, mas criar e publicar
  uma sessão sem imagem própria funciona normalmente (usa o pôster do TMDb)

Rode as migrations e semeie o banco:

```bash
cd ../backend
npm run prisma:migrate
npm run seed
```

O comando de seed imprime no terminal as quatro credenciais e os IDs das sessões criadas.

Suba os dois servidores, cada um em um terminal:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

O back-end sobe em `http://localhost:3000` e o front em `http://localhost:5173`. Entre com uma das
credenciais da seção [Dados de teste](#dados-de-teste).

### Rodando os testes localmente

```bash
cd backend
npm run test:unit
npm run test:integration   # precisa do Postgres local rodando (docker compose up -d db)

cd ../frontend
npm test
```

## O que foi pedido e o que foi implementado

### Front-end

- Navegação e busca pelos eventos publicados, com data, local e preço: seção "Em cartaz" (carrossel
  e destaque) e "Todas as sessões", com busca por título, filtro por intervalo de data e estado
  sincronizado na URL, todos com pôster, data, local e preço em texto normal.
- Criação e gerenciamento de eventos pelo organizador: painel completo em
  `frontend/src/features/organizador`, com assistente de criação em etapas, edição, listagem por
  status e detalhe com vendas.
- Fluxo de reserva com mapa de assentos (modalidade cinema): seleção de fileira e número, com
  indicador visual de onde fica a tela, contador de expiração do hold e realimentação em tempo
  real de quais assentos já foram ocupados por outro cliente. A modalidade "pista por quantidade"
  não foi implementada; o enunciado pede apenas uma das duas.
- Pagamento simulado, com aprovação e recusa: seletor de resultado no checkout, mais um painel
  sempre visível com números de cartão de teste reais do Stripe (aprovado, recusado por cartão,
  recusado por saldo, exige autenticação adicional).
- Área "Meus ingressos", com o ingresso e o código QR.
- Tela de portaria com retorno claro para cada caso: válido, ingresso não encontrado, já utilizado,
  evento errado, assinatura inválida, portaria ainda não aberta e evento já encerrado.
- Leitura do QR pela câmera, com digitação manual como alternativa, sempre disponível mesmo sem
  câmera ou em conexão sem HTTPS.

### Back-end

- Integração com API externa de catálogo: TMDb, com cache das buscas e retentativa automática em
  falha transitória. O enunciado aceita usar TMDb, Ticketmaster ou os dois; só o TMDb foi
  implementado.
- Autenticação com três papéis distintos: organizador, cliente e portaria, cada rota protegida pelo
  papel certo.
- Armazenamento de eventos, reservas e ingressos em Postgres via Prisma.
- Garantia de que o mesmo assento não seja vendido duas vezes: índices parciais únicos no banco,
  não apenas checagem em código. Validado por um teste de concorrência real, disparando vinte
  requisições simultâneas para o mesmo assento e confirmando exatamente uma aprovada e dezenove
  rejeitadas.
- Geração de ingresso com QR não forjável: código assinado com HMAC-SHA256, verificado por
  comparação de tempo constante, nunca um identificador sequencial adivinhável.
- Compartilhamento de ingresso por link gerado pela aplicação, com opção de revogar o link
  depois.
- Validação na portaria sem permitir reuso: a marcação de "usado" é uma atualização atômica
  condicional no banco, sem uma leitura prévia separada que abriria uma corrida entre duas
  validações simultâneas do mesmo ingresso.
- Cobrança simulada, sem transação financeira real, com a opção adicional de usar o ambiente de
  teste de um provedor de pagamento de verdade (Stripe), como o próprio enunciado permite.

### Tecnologias obrigatórias

- Front-end em React (Vite).
- Back-end em Node.js (Express).
- Banco de dados PostgreSQL, com `docker-compose.yml` para subir localmente e instruções completas
  neste README.

### Requisitos não funcionais

- README detalhado com passo a passo de configuração e execução (este arquivo).
- Dados de teste semeados: um organizador, dois clientes, um usuário de portaria e sessões
  publicadas com ingressos disponíveis.
- Deploy publicado, cobrindo o ponto extra do enunciado.

## Implementado além do pedido

Itens que o enunciado não exige, ou que chega a listar como dispensável, mas que foram construídos
porque agregam valor real:

- **Login social com Google**, com verificação de verdade do token de identidade no back-end (não
  só confiar no que o front manda), atrás de uma flag que esconde o botão quando não configurado.
- **Escolha do meio de pagamento no checkout**: além do pagamento simulado (padrão), existe uma
  flag de teste que libera pagar com Stripe de verdade usando Elements embutido na própria tela,
  com cartões de teste reais. Isso cobre as duas leituras possíveis do enunciado ao mesmo tempo,
  cobrança simulada e ambiente de teste de um provedor real, sem exigir escolher uma só.
- **Busca e filtro de eventos**, painel completo do organizador e **cancelamento de ingresso com
  devolução ao estoque** (reembolso parcial do valor daquele assento, sem afetar os demais
  ingressos do mesmo pedido).
- **Upload de imagem própria do evento**, armazenada no Supabase Storage, com validação do
  arquivo pelos bytes reais do arquivo, não pela extensão do nome nem pelo cabeçalho que o
  navegador informou.
- **Mapa de assentos em tempo real**, com atualização por WebSocket e um mecanismo de repescagem
  por HTTP como reserva caso a conexão em tempo real caia.
- **Acessibilidade tratada com cuidado**: o mapa de assentos segue o papel de grade da
  especificação ARIA, com navegação completa pelo teclado, região viva para leitores de tela
  quando outro cliente ocupa um assento, e uma suíte de fumaça dedicada rodando um verificador
  automático de acessibilidade contra cada tela.
- **Integração contínua** no GitHub Actions, rodando migrations, checagem de tipos, lint,
  convenções internas do projeto, auditoria de dependências e a suíte inteira de testes (unitários
  e de integração contra um Postgres real) a cada push, tanto no back quanto no front.
- **Limite de taxa de requisições**, reforçado nas rotas mais sensíveis a abuso (login, portaria,
  compartilhamento de ingresso, reserva de assento).
- **Log estruturado**, com identificador único por requisição propagado em todas as linhas de log
  relacionadas, e remoção automática de dados sensíveis antes de gravar.
- **Idempotência do webhook do Stripe**: o identificador do evento é gravado antes de processar,
  então o mesmo evento entregue duas vezes pela Stripe nunca emite um segundo ingresso.
- **Registro público de bugs encontrados durante o desenvolvimento** (`docs/bugs.md`), com sintoma,
  causa raiz e correção de cada um, incluindo os pegos por teste automatizado e os pegos em
  verificação manual contra o ambiente real.

## Fora de escopo, de propósito

Confirmado por busca no próprio código, nenhum resquício de nota fiscal, revenda de ingresso entre
usuários ou envio de ingresso por e-mail foi construído, exatamente como o enunciado pede para não
fazer. A ausência de "esqueci minha senha" também é deliberada: recuperação de senha está fora de
escopo e há um comentário no componente de login registrando essa decisão, para deixar claro que
não foi um esquecimento.

## Limitações conhecidas

- A modalidade de ingresso por quantidade ("pista", sem assento marcado) não foi implementada; só
  a modalidade de mapa de assentos (cinema) existe. O enunciado aceita qualquer uma das duas.
- A API do Ticketmaster não foi integrada, só a do TMDb. O enunciado aceita qualquer uma das duas,
  ou as duas.
- Um pedido nunca transiciona sozinho para o estado "cumprido" depois que todos os seus ingressos
  são utilizados na portaria; essa transição foi modelada no banco mas a rotina que deveria
  dispará-la nunca foi implementada. Não afeta nenhum fluxo hoje, porque nada no sistema lê esse
  estado específico, mas fica registrado aqui como uma regra pendente.
- Testar o pagamento via Stripe de verdade (não o simulado) exige uma chave de teste real da
  Stripe configurada no back-end; sem ela, escolher essa opção mostra uma tela de erro clara em vez
  de processar o pagamento. O caminho simulado, que é o padrão da aplicação, não depende dessa
  chave.
- A hospedagem gratuita do back-end entra em repouso sem tráfego (ver nota em
  [Testar online](#testar-online)).

## Dados de teste

Criados pelo comando `npm run seed` do back-end, senha igual para os quatro:

| Papel | E-mail | Senha |
|---|---|---|
| Organizador | `organizador@ticketdev.test` | `Ticket@2026` |
| Cliente 1 | `cliente1@ticketdev.test` | `Ticket@2026` |
| Cliente 2 | `cliente2@ticketdev.test` | `Ticket@2026` |
| Portaria | `portaria@ticketdev.test` | `Ticket@2026` |

Três sessões semeadas junto:

- **Duna: Parte Dois**, publicada, já com vendas e assentos ocupados (bom cenário para testar o
  mapa com assentos livres e vendidos misturados).
- **Oppenheimer**, publicada, totalmente livre.
- **Pobres Criaturas**, em rascunho, visível só para o organizador.

O seed também emite, na sessão de Duna, ingressos prontos para os quatro cenários que a portaria
precisa cobrir: um válido, um já utilizado cerca de uma hora atrás, um pertencente a outra sessão
(para testar o retorno de evento errado, escaneando na portaria de Oppenheimer) e a base para
montar um código com assinatura adulterada à mão (troque um caractere qualquer do código e
escaneie ou digite).

## Decisões técnicas por área

Um resumo das escolhas mais relevantes, por área. Não é uma lista exaustiva de tudo que foi feito,
é o raciocínio por trás das partes que mais moldaram o resultado final.

### Banco de dados e modelagem

Prisma sobre PostgreSQL, com driver adapter (Prisma 7 mudou a forma de conectar; a string de
conexão não vive mais direto no schema, e sim num arquivo de configuração próprio que carrega o
ambiente). Dinheiro é sempre inteiro (centavos), nunca ponto flutuante. Datas gravadas em UTC com
fuso IANA guardado à parte no evento; o mapeamento padrão do Prisma para PostgreSQL não marca
colunas de data como cientes de fuso horário por conta própria, então cada campo de data recebeu a
anotação explícita para isso. Transições de estado (pedido, ingresso, evento) passam por uma
checagem central antes de tocar o banco, então um estado inválido nunca chega a ser gravado.

### Autenticação e papéis

Autenticação própria, não delegada ao provedor de autenticação do Supabase, porque o esquema de
papéis do desafio (organizador, cliente, portaria) e as regras de posse de cada recurso são
específicas o bastante para não se encaixarem bem num serviço genérico de terceiros sem gambiarra.
Token de acesso de vida curta e token de renovação com rotação, cada uso do token de renovação
invalida o anterior e qualquer tentativa de reusar um já trocado derruba a sessão inteira, sinal de
possível token roubado. Senha em hash argon2id. Login social com Google, quando configurado,
verifica o token de identidade de verdade no back-end, não confia só no que o front informa.

### Catálogo (TMDb)

Busca e detalhe de filme com cache em banco para não bater na API externa a cada requisição, mais
uma lista de gêneros cacheada em memória por um dia. Falha ao buscar a lista de gêneros nunca
derruba a busca principal, o filme aparece sem os nomes de gênero em vez de mostrar um erro por
causa de um dado secundário. Uma retentativa automática cobre falha de rede ou erro transitório do
lado do TMDb; erro do cliente (filme não encontrado, requisição inválida) nunca tenta de novo.

### Eventos e assentos

Um evento representa ao mesmo tempo o filme (título, sinopse, pôster) e a sessão específica
(horário, sala, formato, idioma, preço), reaproveitando o mesmo registro para os dois. A listagem
pública agrupa por filme para não repetir o mesmo pôster uma vez por sessão; a tela de detalhe
mostra todos os horários daquele filme, agrupados por dia e por combinação de formato, idioma e
tipo de sala. Criar uma sessão exige pelo menos uma hora de antecedência a partir do agora, mesmo
no mesmo dia.

### Reserva e anti-double-booking

A garantia de que um assento não é vendido duas vezes não depende só de checar antes de gravar,
existe um índice único parcial no banco cobrindo exatamente essa condição, então mesmo duas
requisições que cheguem no mesmo instante não conseguem completar as duas. Reserva de assento
(hold) expira sozinha depois de alguns minutos se o cliente não finalizar a compra, liberando o
lugar de volta.

### Pedidos e pagamento

Valor cobrado é sempre calculado no servidor a partir do preço do evento, nunca aceito do corpo da
requisição. Existem dois provedores de pagamento por trás da mesma interface: um simulado
(aprovação ou recusa manual, sem nenhum cartão real) e um real via Stripe em modo de teste,
escolhido por pedido através de uma flag de teste no checkout. Escolher Stripe abre um formulário
de cartão de verdade embutido na própria tela (Stripe Elements), usando os mesmos eventos de
confirmação de pagamento que o webhook real da Stripe já trata. O identificador de cada evento do
Stripe é gravado antes de processar, então reentrega do mesmo evento pela Stripe nunca emite um
segundo ingresso.

### Ingressos e QR

Código do ingresso assinado com HMAC-SHA256 usando um segredo próprio, verificado por comparação
de tempo constante para não vazar informação por quanto tempo a verificação levou. Marcar um
ingresso como usado na portaria é uma atualização condicional direta no banco, sem uma leitura
separada antes, fechando a janela onde duas validações simultâneas do mesmo ingresso poderiam
passar as duas.

### Cancelamento

Cliente cancela um ingresso individual, não o pedido inteiro. O assento volta a ficar livre para
venda, o valor daquele assento específico é reembolsado (nunca o pedido inteiro por causa de um
cancelamento parcial), e o pedido só passa para reembolsado quando não sobra nenhum ingresso ativo
nele. Só é possível cancelar um ingresso ativo de uma sessão que ainda não começou.

### Compartilhamento por link

Cada ingresso pode gerar um link de compartilhamento, com prazo de validade limitado ao fim da
janela em que a portaria ainda aceita aquele ingresso, e pode ser revogado pelo próprio cliente
antes disso.

### Portaria

Além do resultado esperado (válido, já utilizado, evento errado), a portaria também diferencia
assinatura inválida, ingresso não encontrado, portaria ainda não aberta (a validação só é permitida
a partir de duas horas antes do início) e evento já encerrado. Leitura por câmera com biblioteca de
QR no navegador, com digitação manual sempre disponível como alternativa, inclusive em contexto sem
HTTPS, onde a câmera não fica disponível por restrição do próprio navegador.

### Tempo real

O estado de ocupação dos assentos é replicado em tempo real via WebSocket (Supabase Realtime), com
um mecanismo de repescagem por requisição HTTP comum como reserva, caso a conexão em tempo real
caia ou nunca se estabeleça.

### Armazenamento de imagem

Upload de banner do evento vai para um bucket do Supabase Storage, separado da chave de acesso
total ao projeto (essa chave nunca sai do back-end). O arquivo enviado é validado pelos primeiros
bytes reais do conteúdo, não pela extensão do nome do arquivo nem pelo cabeçalho que o navegador
informou, os dois fáceis de forjar.

### Acessibilidade

O mapa de assentos segue o papel de grade da especificação de acessibilidade, com navegação
completa pelas setas do teclado e uma região viva que anuncia para leitor de tela quando outro
cliente ocupa um assento em tempo real. Uma suíte de testes dedicada roda um verificador automático
de acessibilidade contra as telas principais.

## Testes e CI

Suíte completa, rodando neste momento: 217 testes unitários e 155 de integração no back-end
(este último grupo contra um Postgres real, incluindo o teste de concorrência de vinte
requisições simultâneas), mais 305 testes no front-end. Integração contínua no GitHub Actions
executa, a cada push e pull request, checagem de tipos, lint, convenções internas do projeto,
auditoria de dependências, migrations e a suíte inteira, tanto do back quanto do front.

## Uso de IA no processo

Boa parte da implementação foi conduzida com apoio de um assistente de IA agente, operado por
linha de comando, com acesso de leitura e escrita ao repositório sob supervisão constante: ele
executou comandos, rodou e interpretou testes, investigou o código antes de propor mudanças,
ajudou a diagnosticar problemas de configuração de ambiente e de implantação (Render, Vercel,
Supabase, Stripe) e escreveu partes relevantes do código, sempre revisadas antes de seguir adiante.

As decisões de arquitetura, o escopo do que entrar ou não, a validação de cada etapa contra o
comportamento real da aplicação (não só contra o resultado dos testes) e a revisão do código
gerado ficaram por conta do desenvolvedor. Sempre que uma mudança sugerida introduzia
comportamento incerto ou saía do escopo pedido, a orientação explícita foi restringir e verificar
antes de continuar, em vez de aceitar por padrão. Arquivos de plano e de contexto usados ao longo
do processo estão versionados no próprio repositório.
