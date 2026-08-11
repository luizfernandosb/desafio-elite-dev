# Desafio Elite Dev 2026 -- Documentação de Requisitos

> Documento de trabalho extraído do PDF oficial do desafio, reorganizado em formato
> de especificação para guiar a implementação.
>
> **Revisão 2** -- incorpora as decisões de stack, os requisitos de segurança, o escopo
> ampliado (filmes **e** shows) e as definições de tempo real e pagamento.
>
> **Revisão 10** -- Escopo reduzido para **filmes (TMDb) apenas**. Ticketmaster e setores por
> quantidade removidos do escopo ativo. Campo `source` mantido no schema para extensão futura.
>
> **Revisão 3** -- **Supabase** no lugar do Firebase (era confusão de nome). Consequências em
> cadeia: banco, storage, tempo real e deploy mudam junto. Ver §5.3.
>
> **Revisão 4** -- Modelagem central (§4.6): dinheiro em inteiros/centavos, máquina de estados
> explícita para `Order` e `Ticket`, fuso horário IANA + UTC + janela de validação da portaria.
>
> **Revisão 5** -- Arquitetura do código (§5.5): estrutura de pastas por módulo/domínio, regras
> de dependência entre camadas, transações no Service, hierarquia de erros, env validado com Zod.
>
> **Revisão 6** -- Estratégia de testes (§7.10): duas camadas (unit + integração), os 4 testes
> que a banca vai procurar, GitHub Actions com Postgres service container, MSW para APIs externas.
>
> **Revisão 7** -- Plano de corte com datas (§12.1) e acessibilidade no mapa de assentos
> (§5.1.2): `role=grid`, navegação por teclado, estados sem depender só de cor, live region.
>
> **Revisão 8** -- Logging estruturado (§5.5.7): Pino com redact automático, request ID por
> requisição, níveis semânticos por contexto, logging do webhook Stripe, LOG_LEVEL no env.
>
> **Revisão 9** -- Versionamento da API (§5.6): prefixo `/api/v1/`, tabela de rotas completa,
> paginação offset/page com contrato único `PaginatedResponse`, `findMany` + `count` em paralelo.

---

## 1. Objetivo do teste

Validar conhecimentos técnicos em **Front-End**, **Back-End**, lógica de programação e a
capacidade de entender e atender a demanda proposta.

## 2. Proposta de solução

Construir uma **Plataforma de Eventos e Ingressos**:

- O **organizador** monta um evento a partir de um catálogo de **filmes** vindo do **TMDb**,
  definindo **data, local, capacidade e preço** da sessão.
- O **cliente** navega pelos eventos publicados, reserva seu lugar, paga de forma **simulada**,
  recebe um **ingresso com código QR** e pode **compartilhá-lo por link**.
- A **portaria** valida o ingresso na entrada do evento.

## 3. Critério de avaliação declarado (ler antes de codar)

O escopo é pequeno **de propósito**. Não se avalia volume entregue, e sim **como o candidato pensa**:
decisões tomadas, o que foi descartado no caminho, por que a tela é assim e não de outro jeito.

- A banca já rodou este PDF numa ferramenta de IA e recebeu uma aplicação pronta -- entregar
  isso não diferencia nada.
- **Fugir do "AI slop"**: interface genérica que sai pronta da ferramenta e é reconhecível de longe.
  O problema não é a IA ter feito; é ninguém ter escolhido nada.
- Deve haver **mão autoral no resultado**. O sistema é apenas o meio de mostrar isso.

### Implicações práticas
- [ ] Definir uma identidade visual própria (tipografia, paleta, espaçamento, tom) e justificar no README.
- [ ] Registrar decisões e trade-offs conforme surgem (ADRs curtos ou seção no README).
- [ ] Documentar o que foi descartado e por quê.

---

## 4. Requisitos Funcionais

### 4.1 Front-End

| # | Requisito | Status |
|---|-----------|--------|
| FE-1 | Navegação e **busca** pelos eventos publicados (**filmes em cartaz**), exibindo data, local e preço | [ ] |
| FE-2 | **Criação e gerenciamento** dos eventos pelo organizador | [ ] |
| FE-3 | **Fluxo de reserva** com **mapa de assentos** (lugar marcado por sessão) -- ver §4.4 | [ ] |
| FE-4 | **Pagamento simulado**, contemplando **confirmação e recusa** | [ ] |
| FE-5 | Área de **"Meus ingressos"**, exibindo o ingresso e seu código QR | [ ] |
| FE-6 | **Tela de portaria** com retorno claro: **válido / inválido / já utilizado / evento errado** | [ ] |
| FE-7 | **Leitura do QR pela câmera** na portaria, com **digitação manual** do código como alternativa | [ ] |
| FE-8 | **Mapa de assentos em tempo real**: assentos ocupados/em reserva por outros usuários mudam de estado sem recarregar a página | [ ] |
| FE-9 | Telas de autenticação: cadastro, login por e-mail/senha e **login com Google** | [ ] |

### 4.2 Back-End

| # | Requisito | Status |
|---|-----------|--------|
| BE-1 | Gestão das chamadas para **TMDb** (filmes em cartaz e detalhes) -- ver §4.3 | [ ] |
| BE-2 | **Autenticação com três papéis**: Organizador (cria/gerencia eventos), Cliente (reserva, paga, recebe ingressos), Portaria (valida na entrada) | [ ] |
| BE-3 | **Armazenamento** de eventos, reservas e ingressos | [ ] |
| BE-4 | Garantia de que **o mesmo lugar não seja vendido duas vezes** | [ ] |
| BE-5 | Geração de ingresso com **código QR não forjável** | [ ] |
| BE-6 | Lógica de **compartilhamento de ingresso via link** gerado pela aplicação | [ ] |
| BE-7 | Validação na portaria garantindo que **o mesmo ingresso não seja validado duas vezes** | [ ] |
| BE-8 | Cobrança **simulada** via **Stripe em modo de teste** (sem transação real) -- ver §4.5 | [ ] |
| BE-9 | **Rotas autenticadas + autorização por papel** (RBAC) em toda a API -- ver §7 | [ ] |
| BE-10 | Canal de **tempo real** para o mapa de assentos (**Supabase Realtime**) -- ver §4.4 | [ ] |
| BE-11 | **Upload de imagens** (capa/banner do evento) para **Supabase Storage** | [ ] |

**API externa:**
- TMDb -- `developer.themoviedb.org/docs`

> Ticketmaster fora do escopo desta versão. Campo `source` no schema preparado para
> extensão futura sem migração -- ver §4.3.

---

### 4.3 Decisão: TMDb apenas (escopo desta versão)

O PDF permite escolher uma API ou as duas. **Decisão: TMDb apenas**, focando no fluxo de
cinema com mapa de assentos por lugar marcado. Ticketmaster fora do escopo ativo.

**Campo `source` mantido no schema** para extensão futura sem migração:

```
CatalogItem {
  source: 'TMDB'           // 'TICKETMASTER' reservado -- não implementado
  externalId: string
  title: string
  subtitle?: string        // tagline do filme
  synopsis?: string
  imageUrl?: string        // poster_path do TMDb
  runtimeMinutes?: number
  genres: string[]
  suggestedVenue?: { name, city, date }  // preenchido pelo organizador manualmente
}
```

- [ ] `GET /catalog/search?q=` -- busca de filmes no TMDb
- [ ] `GET /catalog/tmdb/:externalId` -- detalhe do filme
- [ ] **Cache** das respostas (tabela `CatalogCache` ou memória com TTL de 10–60 min) --
      TMDb tem rate limit; o organizador busca repetidamente durante a criação do evento.
- [ ] **Degradação graciosa**: se o TMDb cair, catálogo mostra erro tratado e os eventos
      já criados continuam funcionando (snapshot do item salvo no evento, não buscado on-demand).
- [ ] Chave da API **só no back-end**, nunca no bundle do front.

> Registrar no README: "Ticketmaster e setores por quantidade fora do escopo desta versão.
> O campo `source` no schema e o adapter pattern permitem adicionar um segundo provedor
> sem alterar nenhuma tabela existente." 

---

### 4.4 Mapa de assentos em tempo real -- como fazer

Duas camadas com responsabilidades separadas. **Não confundir uma com a outra** -- é o ponto
onde a maioria das implementações erra.

| Camada | Responsabilidade | Ferramenta |
|---|---|---|
| **Correção** (quem fica com o lugar) | Impedir venda dupla. Não pode depender do canal de tempo real. | Postgres: transação + *unique constraint* |
| **Percepção** (o que o usuário vê) | Refletir mudanças de outros usuários sem F5 | **Supabase Realtime** (Postgres Changes) |

> **Por que Realtime e não Socket.IO:** com o Supabase, o tempo real vem do próprio Postgres via
> replicação lógica. O back-end escreve com Prisma e **não precisa fazer broadcast de nada** -- o
> Supabase detecta o `INSERT`/`UPDATE` e empurra para os clientes inscritos. Isso elimina o
> servidor WebSocket, elimina o problema de broadcast entre múltiplas instâncias e, o mais
> importante, **libera o back-end para rodar em serverless** (era o Socket.IO que obrigava um
> processo persistente e complicava o deploy -- ver §5.4).
>
> Contrapartida: o cliente conversa direto com o Supabase usando a `anon key`, então o estado dos
> assentos precisa de política **RLS** de leitura. Disponibilidade de assento é informação pública,
> então isso é aceitável -- mas tem que ser deliberado, não acidental (§7.9).

#### 4.4.1 Modelo de dados (filme -- lugar marcado)

```
Event      { id, type: 'SEATED', ... }
Seat       { id, eventId, sectionId, row, number, kind }   // gerado no seed do evento
SeatHold   { id, eventId, seatId, userId, expiresAt, releasedAt? }
Ticket     { id, eventId, seatId?, orderId, code, usedAt? }
```

Índices que fazem o trabalho pesado:

```sql
-- só UMA reserva ativa por assento
CREATE UNIQUE INDEX seat_hold_active
  ON "SeatHold" ("seatId")
  WHERE "releasedAt" IS NULL;

-- só UM ingresso por assento naquele evento
CREATE UNIQUE INDEX ticket_seat_unique
  ON "Ticket" ("eventId", "seatId")
  WHERE "seatId" IS NOT NULL;
```

> Prisma não cria índice parcial via schema -- declarar em `migration.sql` manual
> (`prisma migrate dev --create-only` e editar). Registrar isso no README.

#### 4.4.2 Fluxo

```
1. Cliente abre o mapa
   → GET /events/:id/seatmap    (snapshot inicial via API: FREE | HELD | SOLD)
   → supabase
       .channel('seatmap:123')
       .on('postgres_changes',
           { event: '*', schema: 'public', table: 'seat_state',
             filter: 'event_id=eq.123' },
           applyPatch)
       .subscribe()

2. Cliente clica num assento
   → POST /events/:id/holds { seatIds: [...] }   [API, autenticado]
     dentro de UMA transação:
       - INSERT em SeatHold (expiresAt = now + 10min)
       - conflito de unique (Prisma P2002) → 409 SEAT_TAKEN
   → o próprio INSERT dispara o evento de Realtime para todos os inscritos

3. Cliente paga  → hold vira Ticket, assento vira SOLD
   → UPDATE dispara o Realtime

4. Cliente desiste / TTL vence
   → releasedAt = now  (pg_cron, ver 4.4.3)
   → UPDATE dispara o Realtime
```

**Escrita sempre pela API, leitura em tempo real direto do Supabase.** O front nunca escreve no
banco pelo cliente Supabase -- se escrevesse, perderia a transação e a validação de regra de
negócio. O cliente Supabase entra no projeto **somente como assinante de leitura**.

**O que expor para o Realtime:** não a tabela `SeatHold` (tem `userId` -- dado de outra pessoa).
Criar uma tabela/view `seat_state` derivada, com apenas `{ eventId, seatId, status, expiresAt }`.
`status` é `FREE | HELD | SOLD`, sem revelar *quem* reservou. Manter em sincronia por trigger no
Postgres ou escrevendo nas duas na mesma transação do Prisma -- decidir e registrar.

#### 4.4.3 Expiração dos holds

O TTL não pode depender do navegador continuar aberto -- nem de o back-end estar acordado.

**Decisão: `pg_cron` (extensão disponível no Supabase) + expiração lazy na leitura.** Combinação
das duas porque cada uma cobre o furo da outra.

```sql
-- extensão habilitada pelo painel: Database → Extensions → pg_cron
SELECT cron.schedule('expire-seat-holds', '* * * * *', $$
  UPDATE "SeatHold"
     SET "releasedAt" = now()
   WHERE "releasedAt" IS NULL
     AND "expiresAt"  < now();
$$);
```

Três vantagens de fazer isso no banco em vez de no Node:

1. Roda mesmo com o back-end em serverless (sem processo persistente, sem `setInterval`).
2. O `UPDATE` **já dispara o Realtime** -- o assento aparece livre nas telas abertas sem uma linha
   de código de broadcast.
3. Continua funcionando se houver mais de uma instância da API, sem coordenação nenhuma.

**Limitação a registrar no README:** a granularidade mínima do `pg_cron` é **1 minuto**, então um
hold pode demorar até ~60 s para aparecer como livre. Por isso a segunda camada: toda leitura de
disponibilidade (snapshot da API e verificação no momento do hold) trata `expiresAt < now()` como
livre. Assim a **correção** é imediata e só a **percepção** tem o atraso de até um minuto.

Alternativas descartadas: `setInterval` no processo Node (quebra em serverless, quebra com
múltiplas instâncias) e BullMQ + Redis (correto, mas adiciona um serviço inteiro ao stack para
resolver algo que uma linha de cron resolve).

#### 4.4.4 Setores por quantidade -- fora de escopo desta versão

Implementação removida do escopo. O modelo de `Section` com `reserved` atômico está
documentado na revisão 2 caso seja retomado. Nenhum código de setor/pista na base atual.

#### 4.4.5 Fallback e testes

- [ ] Se o canal do Realtime não conectar (ou o status vier `CHANNEL_ERROR` / `TIMED_OUT`), cair
      para **polling do snapshot da API a cada 5 s** -- o fluxo nunca quebra por causa do tempo real.
      Indicador visual de "ao vivo / reconectando".
- [ ] Revalidar o snapshot pela API ao reconectar: durante a queda o cliente perdeu eventos, e o
      Realtime **não faz replay** do que passou.
- [ ] Nunca deixar o botão de confirmar reserva depender do estado vindo do Realtime. O 409 da API
      é a resposta autoritativa; o mapa é só uma dica visual (que pode estar 1 s desatualizada).
- [ ] Teste de concorrência (Vitest): `Promise.all` com N requisições no **mesmo** assento →
      exatamente 1 sucesso e N-1 com 409.

---

### 4.5 Pagamento: Stripe atende?

**Sim, e é a melhor escolha aqui.** O modo de teste do Stripe é gratuito, não movimenta dinheiro
real, e o PDF explicitamente autoriza "ambiente de testes de um provedor de pagamento de verdade" --
usar o Stripe conta a favor em vez de um mock caseiro.

**Decisão: Stripe em test mode com Payment Intents.**

Por que Payment Intents e não Checkout hospedado: o Checkout redireciona para uma página do
Stripe, e essa página é justamente a parte da experiência que o desafio quer ver como autoral.
Com Payment Intents + Stripe Elements, o formulário mora na sua UI.

#### Como forçar aprovação e recusa (requisito FE-4)

Cartões de teste do Stripe -- não precisa de nenhuma gambiarra para simular a recusa:

| Cartão | Resultado |
|---|---|
| `4242 4242 4242 4242` | aprovado |
| `4000 0000 0000 0002` | recusado (`card_declined`) |
| `4000 0000 0000 9995` | recusado por saldo insuficiente |
| `4000 0025 0000 3155` | exige autenticação 3DS |

- [ ] Deixar esses números **visíveis na própria tela de pagamento** em ambiente de teste. A banca
      precisa conseguir testar a recusa sem ler documentação.
- [ ] Chave secreta só no back-end; `pk_test_...` no front.
- [ ] **Webhook** (`payment_intent.succeeded` / `payment_intent.payment_failed`) como fonte da
      verdade para emitir o ingresso -- nunca confiar só no retorno do browser. Local: `stripe listen`
      via Stripe CLI. Validar a assinatura do webhook.
- [ ] **Idempotência**: `Idempotency-Key` na criação do PaymentIntent e webhook idempotente
      (mesmo evento entregue duas vezes não emite dois ingressos).
- [ ] Recusa **devolve o assento ao estoque** (ou mantém o hold vivo pelo TTL restante para
      permitir nova tentativa -- decidir e documentar qual dos dois).
- [ ] Plano B documentado: se a integração travar, um `FakePaymentProvider` atrás da mesma
      interface (`PaymentProvider`) mantém o fluxo demonstrável. Escrever o código já com essa
      interface, não depois.

---

### 4.6 Modelagem central

Esta seção expande o modelo introduzido em §4.4.1 para cobrir o projeto inteiro. Três
decisões que não aparecem em tutorial nenhum mas que um sênior vai procurar primeiro.

#### 4.6.1 Dinheiro nunca é `float`

`float` e `double` não representam a maioria dos decimais com precisão exata. `0.1 + 0.2`
em JavaScript dá `0.30000000000000004`. Num sistema de ingresso isso significa preço exibido
diferente do preço cobrado -- categoria de bug que não aparece em teste unitário feliz e
aparece em produção com valores específicos.

**Regra:** todo valor monetário é armazenado como **inteiro em centavos** (`Int` no Prisma).
A conversão acontece só na borda, em dois lugares: exibição no front (`centavos / 100`,
formatado com `Intl.NumberFormat`) e envio ao Stripe (`amount` já espera centavos -- não
há conversão necessária, o que elimina uma classe inteira de bugs).

```prisma
model Event {
  priceInCents  Int      // 18000 = R$ 180,00
  currency      String   @default("BRL")
}

model Order {
  amountInCents Int      // soma dos ingressos no momento da compra
  currency      String   @default("BRL")
}
```

`currency` como campo explícito -- não um comentário. Mesmo que o sistema só suporte BRL hoje,
o campo documenta a intenção e evita que alguém some valores de moedas diferentes no futuro.

**No front**, uma função utilitária única que nunca é duplicada:

```ts
// utils/money.ts
export const formatMoney = (cents: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)

// uso: formatMoney(18000) → "R$ 180,00"
```

Registrar no README: "valores monetários em centavos (Int). `float` nunca toca dinheiro."
É uma linha. Mas quem lê sabe que você já viu esse bug antes.

#### 4.6.2 Máquina de estados explícita

O maior risco de consistência neste sistema não é o double-booking -- é um `Order` que ficou
`PENDING` para sempre porque o webhook falhou, ou um `Ticket` que foi emitido sem `Order`
confirmado porque alguém chamou o endpoint na ordem errada.

A solução não é validação manual em cada endpoint. É tornar os estados e as transições
válidas **parte do modelo**, não da lógica espalhada.

**`Order`**

```
PENDING ──[webhook: payment_intent.succeeded]──▶ PAID ──[portaria valida]──▶ FULFILLED
   │
   ├──[webhook: payment_intent.payment_failed]──▶ FAILED
   │
   └──[TTL: 30 min sem pagamento]────────────────▶ EXPIRED
```

```prisma
enum OrderStatus {
  PENDING     // PaymentIntent criado, aguardando pagamento
  PAID        // webhook confirmou -- ingresso pode ser emitido
  FAILED      // recusado -- assento devolvido ao estoque
  EXPIRED     // TTL venceu sem pagamento
  REFUNDED    // cancelamento futuro (fora de escopo, mas reservar o estado)
}

model Order {
  id            String      @id @default(cuid())
  userId        String
  eventId       String
  status        OrderStatus @default(PENDING)
  amountInCents Int
  currency      String      @default("BRL")
  stripePaymentIntentId String? @unique
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  expiresAt     DateTime    // now + 30min -- pg_cron expira igual aos SeatHolds
  tickets       Ticket[]
}
```

Transições válidas aplicadas no serviço -- não no controller:

```ts
// services/order.service.ts
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ['PAID', 'FAILED', 'EXPIRED'],
  PAID:      ['FULFILLED', 'REFUNDED'],
  FAILED:    [],
  EXPIRED:   [],
  FULFILLED: ['REFUNDED'],
  REFUNDED:  [],
}

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!VALID_TRANSITIONS[from].includes(to))
    throw new InvalidTransitionError(`${from} → ${to} não é uma transição válida`)
}
```

Qualquer caminho que não esteja na tabela lança erro antes de tocar o banco. O webhook de
`payment_intent.succeeded` numa `Order` já `PAID` não faz nada -- idempotência de graça.

**`Ticket`**

```
ACTIVE ──[portaria valida]──▶ USED
  │
  └──[order cancelada]────────▶ CANCELLED
```

```prisma
enum TicketStatus {
  ACTIVE      // emitido, pronto para uso
  USED        // validado na portaria
  CANCELLED   // order estornada
}

model Ticket {
  id            String       @id @default(cuid())
  orderId       String
  eventId       String
  seatId        String?      // sempre preenchido nesta versão (apenas SEATED)
  status        TicketStatus @default(ACTIVE)
  codeHash      String       @unique  // HMAC armazenado em hash (§7.6)
  shareToken    String?      @unique  // token de link público (§7.7)
  usedAt        DateTime?
  validatedById String?      // userId do operador de portaria
  createdAt     DateTime     @default(now())
}
```

**`SeatHold`** -- já modelado em §4.4.1, repetido aqui por completude:

```prisma
model SeatHold {
  id          String    @id @default(cuid())
  eventId     String
  seatId      String
  userId      String
  expiresAt   DateTime
  releasedAt  DateTime?
  orderId     String?   // preenchido quando o hold vira Order -- rastreabilidade
}
```

**Invariante que o banco garante, não o código:**
um `Ticket` com `status = ACTIVE` e `seatId` preenchido implica exatamente um `SeatHold`
com `releasedAt` preenchido (o hold foi "consumido" pela compra). O índice parcial único em
`Ticket(eventId, seatId) WHERE seatId IS NOT NULL` garante que não existem dois tickets
ativos para o mesmo assento. Documentar essa invariante num comentário no schema.

#### 4.6.3 Fuso horário -- a armadilha que derruba plataformas de evento

Evento é uma das poucas entidades onde fuso horário importa de verdade para o usuário final.
"Show às 21h" em Manaus é diferente de "show às 21h" em São Paulo -- e a diferença são 60
ingressos vendidos para a hora errada se isso não for tratado.

**Regra:** o banco armazena **sempre em UTC**. O Postgres com `timestamptz` faz isso
automaticamente. Com Prisma, `DateTime` mapeia para `timestamptz` -- correto por padrão,
mas só se a variável de ambiente `TZ=UTC` estiver setada no processo Node. Sem ela, o Node
usa o fuso do servidor (que pode ser qualquer coisa em produção). **Adicionar `TZ=UTC` ao
`.env.example` e ao workflow de deploy.**

```prisma
model Event {
  startsAt      DateTime   // armazenado UTC, exibido no fuso do evento
  endsAt        DateTime?
  timezone      String     // "America/Sao_Paulo", "America/Manaus", etc.
  // NÃO armazenar o offset numérico (-3, -4) -- offset muda com horário de verão
}
```

`timezone` como string IANA, não como offset. Brasil tem quatro fusos e o horário de verão
volta a acontecer eventualmente -- offset fixo quebraria datas futuras quando as regras
mudarem. A biblioteca que resolve isso sem dor é `@internationalized/date` (usada pelo
React Aria) ou `Temporal` (API nativa, já disponível em Node 22 atrás de flag).

**No front:**

```ts
// Exibe a data/hora no fuso do evento, não do usuário
import { toZoned, toCalendarDateTime } from '@internationalized/date'

function formatEventDate(utcDate: Date, timezone: string) {
  const zoned = toZoned(toCalendarDateTime(utcDate), timezone)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(utcDate)
}
// "sábado, 23 de agosto de 2026 às 21:00"
// exibido no fuso do evento, independente de onde o usuário está
```

**Janela de validação da portaria:** a portaria só pode validar ingressos de um evento
durante uma janela de tempo. Sugestão: `startsAt - 2h` até `endsAt` (ou `startsAt + 6h`
se `endsAt` for nulo). Sem essa janela, um ingresso de show de 2024 é tecnicamente "válido"
para sempre -- BE-7 (anti-double-validation) resolve o reuso, mas não o evento expirado.

```ts
// Checagem no serviço de validação
function assertValidationWindow(event: Event) {
  const now = new Date()
  const opens = new Date(event.startsAt.getTime() - 2 * 60 * 60 * 1000)
  const closes = event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 60 * 60 * 1000)
  if (now < opens) throw new AppError('GATE_TOO_EARLY', 'Portaria ainda não abriu')
  if (now > closes) throw new AppError('GATE_CLOSED', 'Evento já encerrado')
}
```

Registrar no README: "datas em UTC no banco, timezone IANA no campo `timezone`. Exibição
sempre no fuso do evento. Janela de portaria: 2h antes até 6h após o início."

---

## 5. Stack escolhida

### 5.1 Front-End

| Item | Escolha |
|---|---|
| Biblioteca | **React** |
| Build/dev | **Vite** |
| Testes | **Vitest** + Testing Library |
| Linguagem | TypeScript |

Definir e registrar no README: roteamento (React Router), estado de servidor (TanStack Query
recomendado -- cache, revalidação e integração limpa com o snapshot do mapa), forms + validação
(React Hook Form + Zod), e a abordagem de estilo. Sobre estilo, lembrar §3: componentes prontos
de biblioteca genérica são exatamente o que a banca chama de "cara de projeto gerado". Se usar
uma base (shadcn, Radix), **retematizar de verdade** -- tipografia, paleta, raio, espaçamento --
e explicar as escolhas.

Leitura de QR pela câmera: `html5-qrcode` ou `@zxing/browser`. **A câmera exige HTTPS**
(exceto `localhost`) -- outro argumento a favor do deploy.

### 5.1.1 Identidade visual -- TicketDev

Esta seção documenta as decisões de design que vão no README. Não é aspiracional -- é o que
será implementado e defendido.

**Personalidade:** energética e jovem. A plataforma serve sessões de cinema com experiência
  de compra moderna -- contra-ponto visual ao Ingresso.com.
O tom visual compete com Sympla e Ingresso.com mas não copia nenhum dos dois -- a identidade
própria é o diferencial declarado no critério de avaliação.

**Nome:** TicketDev -- direto, sem inventar palavra. Registrar no README que a escolha foi
deliberada: nome funcional que não compete com a identidade visual por atenção.

#### Paleta

| Token | Hex | Uso |
|---|---|---|
| `--primary` | `#0097FF` | Botões CTA, links, destaques, preço em evidência |
| `--primary-hover` | `#024DDF` | Estado hover/active, sombra de foco, gradiente de profundidade |
| `--primary-light` | `#33AAFF` | Acento luminoso em hover de cards, ícones secundários |
| `--primary-dark` | `#001F6B` | Âncora escura -- rodapé, barra de navegação em dark mode |
| `--primary-tint` | `#E6F4FF` | Superfície tintada -- fundo de badge de gênero, fundo de input com foco |
| `--success` | `#1DB954` | Portaria: válido, pagamento aprovado, ingresso ativo |
| `--danger` | `#FF3B30` | Portaria: inválido, pagamento recusado, assento indisponível |
| `--warning` | `#FF9500` | Portaria: já utilizado, estoque baixo |
| `--neutral-gate` | `#8E8E93` | Portaria: evento errado (neutro -- não é erro do usuário) |

Neutros de superfície via CSS variables do sistema (`--surface-0/1/2`, `--text-primary`,
`--text-secondary`) -- dark mode automático sem uma linha extra.

**Por que dois azuis e não gradiente:** gradiente em button CTA é o marcador visual mais
imediato de "projeto gerado". `#0097FF` sólido no estado default e `#024DDF` no hover cria
profundidade sem gradiente -- e é uma escolha que precisa de uma frase para explicar, o que
é exatamente o que a banca quer ler.

#### Tipografia

**Inter para tudo** -- uma fonte só, variada por peso e tamanho. Justificativa: Inter é
legível em qualquer tamanho, gratuita, e o projeto demonstra domínio tipográfico pela
escala e pelo tracking, não pela quantidade de fontes.

| Escala | Tamanho | Peso | Tracking | Uso |
|---|---|---|---|---|
| Display | 48px | 900 | `-0.04em` | Logo, hero -- só acima da dobra |
| H1 | 32px | 700 | `-0.03em` | Título de página |
| H2 | 22px | 600 | `-0.02em` | Título de card, seção |
| H3 | 18px | 600 | `-0.015em` | Subtítulo, nome de evento |
| Body | 16px | 400 | `0` | Texto corrido, descrição |
| Small | 14px | 400 | `0` | Metadados, datas, locais |
| Caption | 12px | 500 | `+0.02em` | Labels em uppercase, setor, categoria |

Tracking negativo nos títulos grandes não é decoração -- compensa a interpolação hinting
do Inter em tamanhos grandes e mantém as letras unidas como bloco visual.

#### Estados da portaria (FE-6)

Os quatro retornos exigidos têm cores semânticas distintas e não intercambiáveis:

```
VÁLIDO       → fundo #E6F9EE  texto #0A7A35  ícone check      (verde: tudo certo)
INVÁLIDO     → fundo #FFF0F0  texto #CC1B1B  ícone x          (vermelho: problema real)
JÁ UTILIZADO → fundo #FFF4E5  texto #995700  ícone aviso      (âmbar: atenção, não erro)
EVENTO ERRADO→ fundo #F0F0F0  texto #555555  ícone proibido   (neutro: contexto errado)
```

"Evento errado" é neutro (cinza) porque não é falha do usuário nem do sistema -- é um
ingresso válido apresentado na portaria errada. Vermelho aqui seria alarme desnecessário.
Registrar essa distinção semântica no README.

#### Componentes com decisão visual própria

- **Mapa de assentos:** assento livre = borda `--primary` fina, fundo transparente.
  Assento held (outro usuário, tempo real) = fundo `--primary-tint`, sem interatividade.
  Assento selecionado (eu) = fundo `--primary`, texto branco.
  Assento vendido = fundo `--surface-1`, borda `--border`, cursor `not-allowed`.
  As quatro diferenças precisam funcionar sem depender só de cor -- forma ou ícone como
  redundância para acessibilidade.

- **Card de evento:** poster do TMDb como fundo com overlay escuro gradual
  (só na parte inferior onde o texto aparece). Não na imagem inteira -- clichê de card.
  Preço em `--primary`, peso 700, sempre visível sem hover.

- **Botão CTA primário:** `background: #0097FF`, `color: #fff`, sem sombra, sem gradiente.
  Hover: `background: #024DDF`, transição `150ms ease`. Active: `scale(0.98)`. É isso.

### 5.1.2 Acessibilidade no mapa de assentos

O mapa de assentos é o componente mais difícil de tornar acessível neste projeto. Um grid
de 200 células com quatro estados visuais (livre, held, selecionado, vendido) precisa
funcionar sem mouse -- e sem uma abordagem deliberada vira uma grade de `<div>` que
leitores de tela ignoram completamente.

**Estrutura semântica correta:**

```tsx
// SeatMap.tsx
<div
  role="grid"
  aria-label="Mapa de assentos -- Sala 1"
  aria-rowcount={rows.length}
>
  {rows.map((row, rowIndex) => (
    <div key={row.label} role="row" aria-rowindex={rowIndex + 1}>
      <span role="rowheader">{row.label}</span>
      {row.seats.map((seat, colIndex) => (
        <SeatCell
          key={seat.id}
          seat={seat}
          colIndex={colIndex + 1}
          onSelect={handleSelect}
        />
      ))}
    </div>
  ))}
</div>
```

```tsx
// SeatCell.tsx
function SeatCell({ seat, colIndex, onSelect }) {
  const isAvailable = seat.status === 'FREE'
  const isSelected  = seat.status === 'SELECTED'
  const isHeld      = seat.status === 'HELD'   // outro usuário, tempo real
  const isSold      = seat.status === 'SOLD'

  // label descritivo para leitores de tela
  const label = [
    `Assento ${seat.row}${seat.number}`,
    isAvailable ? 'disponível'  : null,
    isSelected  ? 'selecionado' : null,
    isHeld      ? 'reservado por outro usuário' : null,
    isSold      ? 'vendido'     : null,
  ].filter(Boolean).join(', ')

  return (
    <div
      role="gridcell"
      aria-colindex={colIndex}
      aria-selected={isSelected}
      aria-disabled={isSold || isHeld}
      aria-label={label}
      tabIndex={isAvailable || isSelected ? 0 : -1}
      onClick={isAvailable || isSelected ? () => onSelect(seat) : undefined}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && (isAvailable || isSelected)) {
          e.preventDefault()
          onSelect(seat)
        }
        // navegação pelo grid com setas -- ver abaixo
        handleArrowNavigation(e)
      }}
    />
  )
}
```

**Navegação por teclado no grid:**

`role="grid"` implica que as setas navegam entre células -- o browser não faz isso
automaticamente. É preciso implementar:

```ts
function handleArrowNavigation(e: React.KeyboardEvent, seatId: string) {
  const moves: Record<string, [number, number]> = {
    ArrowRight: [0, +1],
    ArrowLeft:  [0, -1],
    ArrowDown:  [+1, 0],
    ArrowUp:    [-1, 0],
  }
  if (!moves[e.key]) return
  e.preventDefault()

  const [currentRow, currentCol] = getSeatPosition(seatId) // {row, col} do assento atual
  const [dRow, dCol] = moves[e.key]
  const next = findSeat(currentRow + dRow, currentCol + dCol)
  if (next) {
    document.querySelector(`[data-seat-id="${next.id}"]`)?.focus()
  }
}
```

**Diferença de estado sem depender só de cor:**

A banca que avalia "interface bem feita" vai testar com zoom a 200% e contraste alto. As
quatro variações precisam ser distinguíveis sem cor:

| Estado | Cor | Forma/ícone adicional | Border |
|---|---|---|---|
| Livre | fundo transparente | nenhum | `--primary` 1px |
| Held (outro) | `--primary-tint` | `·` centralizado | `--primary` 1px tracejado |
| Selecionado (eu) | `#0097FF` | `✓` centralizado branco | nenhum |
| Vendido | `--surface-1` | `✕` centralizado muted | `--border` 0.5px |

O `·` no held e o `✕` no vendido são a redundância que torna o mapa funcional para
usuários com daltonismo sem precisar de modo especial.

**Live region para atualizações em tempo real:**

Quando o Supabase Realtime muda o estado de um assento enquanto o usuário está no mapa,
um leitor de tela precisa ser avisado -- mas sem interromper a cada mudança:

```tsx
// anúncio discreto de mudanças no mapa
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"   // visualmente oculto, lido pelo leitor de tela
>
  {liveAnnouncement}
  {/* ex: "Assento A12 foi reservado por outro usuário" */}
</div>
```

`aria-live="polite"` anuncia após o usuário terminar o que está fazendo -- não interrompe
no meio de uma navegação. `aria-live="assertive"` seria para emergências (erro de conexão
crítico) -- usar com parcimônia.

**O que registrar no README:**

"Mapa de assentos implementado com `role=grid`, navegação por teclado com setas, e estados
visuais diferenciados por forma além de cor. Live region anuncia mudanças em tempo real
para leitores de tela."

Uma frase. Mas quem avalia vai abrir o DevTools, inspecionar o HTML e ver o `role="grid"`
-- e vai saber que foi escolha, não acidente.

#### O que não fazer (registrar no README como descartado)

- Gradiente azul no CTA -- marca de projeto gerado.
- Dark mode com fundo `#0a0a0a` puro e texto branco -- contraste agressivo demais para
  leitura longa; usar `--surface-0` do sistema que é levemente temperado.
- Animações de entrada por elemento (`fadeInUp` em cada card) -- cansa em scroll longo;
  no máximo `opacity` com `transition` no hover do card individual.
- Fonte display diferente da fonte de corpo -- adiciona complexidade sem ganho real para
  uma plataforma funcional.

### 5.2 Back-End

| Item | Escolha |
|---|---|
| Runtime | **Node.js** (LTS 22+) |
| Framework | **Express** |
| ORM | **Prisma** |
| Banco | **PostgreSQL gerenciado pelo Supabase** |
| Storage de imagens | **Supabase Storage** |
| Tempo real | **Supabase Realtime** |
| Login social | **Google Identity Services** + verificação no servidor (§7.3) |
| Testes | **Vitest** + Supertest |
| Pagamento | **Stripe** (test mode) |

Um fornecedor só para banco, arquivos e tempo real. É a diferença prática em relação à revisão
anterior: o Firebase obrigava Postgres em um lugar e arquivos em outro, porque **o Prisma não tem
conector para Firestore**. O Supabase *é* Postgres, então o Prisma é cliente de primeira classe e
tudo cai no mesmo projeto.

### 5.3 Supabase -- o que usar de cada parte, e as armadilhas

O Supabase é um guarda-chuva de vários produtos. Usar todos por estarem ali é como se acaba com
duas fontes de verdade. Recorte deliberado:

| Produto Supabase | Uso neste projeto | Motivo |
|---|---|---|
| **Postgres** | ✅ fonte única da verdade, via Prisma | é o que garante o anti-double-booking |
| **Storage** | ✅ imagens de banner/capa | 1 GB no free tier, sem cartão |
| **Realtime** | ✅ mapa de assentos ao vivo (§4.4) | dispensa servidor WebSocket |
| **Auth** | ❌ ver §7.3 | conflita com o requisito de JWT/hash próprios |
| **Edge Functions** | ❌ | a API é Express; dois runtimes é complexidade sem ganho |
| **PostgREST** (API auto) | ❌ para escrita, ✅ só leitura via Realtime | regra de negócio mora na API |

#### 5.3.1 ⚠️ Prisma + Supabase: connection string (erra muita gente aqui)

O Supabase fica atrás de um *connection pooler* (Supavisor), e o Prisma precisa de **duas** URLs
porque *migrations* e *runtime* têm exigências diferentes:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooler, porta 6543, transaction mode
  directUrl = env("DIRECT_URL")     // porta 5432, para migrate/introspect
}
```

```bash
# runtime da aplicação -- pooler em transaction mode
DATABASE_URL="postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# migrations (prisma migrate / db push / studio) -- conexão de sessão
DIRECT_URL="postgresql://...@...pooler.supabase.com:5432/postgres"
```

- `pgbouncer=true` é obrigatório: sem ele o Prisma tenta usar *prepared statements*, que o pooler
  em transaction mode não suporta → erros intermitentes e difíceis de diagnosticar.
- `prisma migrate` **não funciona** pela porta 6543 -- precisa de conexão de sessão.
- A conexão direta ao host `db.<ref>.supabase.co` é **IPv6-only** em projetos novos (IPv4 é add-on
  pago). Se a máquina ou o host de deploy não tiver IPv6, usar o **session pooler na 5432**, como
  acima. É a causa mais comum de "funciona na minha máquina, falha no CI".
- Pegar as strings prontas no painel: **Connect** → *ORMs* → *Prisma*. Não montar à mão.

#### 5.3.2 ⚠️ `prisma migrate reset` é destrutivo aqui

O Supabase mantém schemas próprios (`auth`, `storage`, `realtime`, `extensions`) no mesmo banco.
Um `migrate reset` pode derrubar objetos gerenciados pela plataforma.

- [ ] Manter o schema da aplicação em `public` e **não introspectar** os schemas do Supabase
      (não rodar `prisma db pull` sem `--schema` restrito).
- [ ] **Desenvolver contra um Postgres local** (Docker) e usar o Supabase como ambiente de
      staging/produção. `migrate reset` só no local. Bônus: dá o primeiro serviço do
      `docker-compose.yml`, se ele acontecer (§5.4).
- [ ] Não usar o schema `auth` do Supabase -- a tabela de usuários é da aplicação (§7.3).

#### 5.3.3 ⚠️ O maior risco operacional: pausa por inatividade

<!-- Este item pode custar a nota inteira. Ler duas vezes. -->

Projetos do plano gratuito são **pausados automaticamente após 7 dias sem atividade** no banco, e
só voltam com uma ação manual no painel. O aviso chega por e-mail antes, e alguns pedidos ao banco
por dia já bastam para evitar.

**Por que isso é grave neste desafio:** o prazo é de 7 dias e a banca avalia depois. O cenário
realista é entregar, o projeto ficar quieto, e o avaliador abrir o link com o banco pausado -- a
aplicação inteira aparece quebrada por um motivo que não tem nada a ver com o código.

- [ ] **GitHub Actions com cron** batendo num endpoint `/health` que faz um `SELECT 1` -- duas ou
      três vezes por semana. Quinze minutos de trabalho, elimina o risco.
- [ ] Endpoint `/health` **sem autenticação** mas com rate limit e sem revelar nada além de
      `{ status, db: 'up' }`.
- [ ] Anotar no README que o projeto está no free tier e que existe o keep-alive -- mostra que o
      risco foi previsto, não ignorado.

#### 5.3.4 Storage: como configurar

- [ ] Bucket `event-images` **público** (banner de evento é conteúdo público mesmo; URL pública
      evita a complexidade de renovar signed URL na listagem).
- [ ] **Upload sempre pela API**, com a `service_role key` no back-end. A `service_role key`
      **nunca** vai para o front -- ela ignora RLS e é equivalente a acesso total ao banco.
- [ ] Nome do arquivo gerado no servidor (`ulid()` + extensão validada). Nunca o nome enviado
      pelo cliente.
- [ ] Validar **MIME real por magic bytes**, não pela extensão nem pelo header `Content-Type`
      (ambos são controlados pelo cliente). Limite de tamanho e whitelist `image/jpeg|png|webp`.
- [ ] Isolar atrás de `StorageProvider { upload(file): url; remove(url) }` -- troca de fornecedor
      passa a custar um arquivo, e o teste unitário roda com um provider em memória.

#### 5.3.5 Chaves e limites do free tier

| Chave | Onde vive | Observação |
|---|---|---|
| `SUPABASE_URL` | front e back | pública |
| `anon key` | **front** | pública por design; protegida por RLS |
| `service_role key` | **só back-end** | ignora RLS -- vazar equivale a vazar o banco |
| `DATABASE_URL` / `DIRECT_URL` | só back-end | credencial do Postgres |

Free tier: 500 MB de banco, 1 GB de arquivos, 5 GB de egresso, 2 projetos ativos, sem cartão.
Folgado para o desafio -- os limites que importam aqui são a pausa (5.3.3) e o de conexões
simultâneas do Realtime, que só apareceria com muitos avaliadores ao mesmo tempo.

### 5.4 Docker

**Decisão postergada**, conforme definido: avaliar depois que a aplicação estiver rodando de
ponta a ponta. Consta em Opcionais (§8).

Para não fechar a porta, manter desde já: toda configuração em variáveis de ambiente
(nada de host/porta hardcoded), `.env.example` atualizado, e um `package.json` com scripts
independentes do ambiente.

> **A troca para Supabase destravou o deploy.** Na revisão anterior, o Socket.IO exigia um processo
> persistente e obrigava o back-end a sair da Vercel (Render/Railway/Fly). Com o Realtime vindo do
> Supabase e a expiração de holds no `pg_cron`, **a API ficou stateless** -- front e back podem ir
> os dois para a Vercel, e o Docker volta a ser puramente opcional. Único cuidado em serverless:
> `connection_limit=1` na URL do pooler (§5.3.1), senão cada invocação abre conexões novas e o
> pool estoura.

---

### 5.5 Arquitetura do código -- back-end

Esta seção define como o código se organiza, quem pode falar com quem, e onde mora cada
responsabilidade. É o que a banca chama de "organização do código" na lista de diferenciais --
e é o que mais varia entre um projeto gerado e um projeto pensado.

### 5.5.1 Estrutura de pastas

```
src/
├── config/          # variáveis de ambiente validadas com Zod (nunca process.env espalhado)
├── lib/
│   ├── prisma.ts    # singleton do PrismaClient
│   ├── stripe.ts    # singleton do Stripe
│   └── logger.ts    # singleton Pino com redact, base fields e transport condicional
├── modules/         # um módulo por domínio
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   └── auth.routes.ts
│   ├── events/
│   │   ├── events.controller.ts
│   │   ├── events.service.ts
│   │   ├── events.repository.ts
│   │   └── events.routes.ts
│   ├── orders/
│   ├── tickets/
│   ├── catalog/     # adapter TMDb (source='TMDB'; Ticketmaster reservado)
│   └── gate/        # validação de portaria
├── middlewares/
│   ├── request-logger.middleware.ts  # requestId + log de entrada/saída por requisição
│   ├── auth.middleware.ts            # requireAuth, requireRole
│   ├── validate.middleware.ts        # Zod parseando body/params/query
│   └── error.middleware.ts           # handler global de erro -- usa req.log
├── shared/
│   ├── errors.ts       # classes AppError, InvalidTransitionError, etc.
│   ├── money.ts        # formatMoney -- uma função, um lugar
│   ├── date.ts         # formatEventDate, assertValidationWindow
│   └── pagination.ts   # PaginatedResponse, paginate(), paginationSchema
├── routes/
│   └── v1/
│       └── index.ts    # monta todos os módulos sob /api/v1
└── app.ts              # Express setup -- sem lógica de negócio
```

Módulo por domínio em vez de pasta por camada (`controllers/`, `services/`, `repositories/`
na raiz). Motivo: quando você abre um módulo, todos os arquivos relacionados estão juntos.
Quando abre `controllers/`, você ainda não sabe nada sobre o domínio. Registrar no README.

### 5.5.2 Camadas e regras de dependência

**Decisão: Controller → Service → Repository (Opção A)**

Três camadas com uma regra de dependência estrita: cada camada só conhece a camada
imediatamente abaixo. Controller não importa Repository. Service não importa Express.

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Controller                                         │
│  • Recebe req, devolve res                          │
│  • Valida input (via middleware Zod, não aqui)      │
│  • Chama o Service com dados já limpos              │
│  • Mapeia AppError → status HTTP                    │
│  • Zero regra de negócio. Zero Prisma.              │
└─────────────────────┬───────────────────────────────┘
                      │ chama
                      ▼
┌─────────────────────────────────────────────────────┐
│  Service                                            │
│  • Regra de negócio inteira mora aqui               │
│  • Abre e fecha transações Prisma                   │
│  • Chama outros Services quando necessário          │
│  • Lança AppError (nunca HttpError diretamente)     │
│  • Zero Express (req/res nunca entram aqui)         │
│  • Testável sem HTTP -- só instanciar e chamar       │
└─────────────────────┬───────────────────────────────┘
                      │ chama
                      ▼
┌─────────────────────────────────────────────────────┐
│  Repository                                         │
│  • Único lugar que importa PrismaClient             │
│  • Queries e nada mais -- sem if, sem cálculo        │
│  • Recebe o tx (PrismaClient | Prisma.TransactionClient)
│    como parâmetro -- nunca usa o singleton diretamente
│    dentro de uma transação                          │
│  • Testável com mock do Prisma sem banco real       │
└─────────────────────────────────────────────────────┘
```

**Por que Repository se o Prisma já é type-safe:** isola o Prisma numa borda. O Service
não sabe se os dados vêm do Postgres, de um mock em memória, ou de um fixture de teste.
Isso torna o teste do Service trivial -- instanciar com um Repository falso e testar a
lógica pura. Registrar essa justificativa no README.

### 5.5.3 Transações -- a regra mais importante

Uma transação pertence ao **Service**. Nunca ao Repository, nunca ao Controller.

O padrão que elimina a categoria inteira de bug de "partial write":

```ts
// orders/orders.service.ts
async createOrder(userId: string, eventId: string, seatIds: string[]) {
  return prisma.$transaction(async (tx) => {
    // 1. verifica disponibilidade -- dentro da tx, com lock implícito
    const holds = await this.seatHoldRepo.createMany(tx, {
      eventId, seatIds, userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    // se algum assento já estiver held → P2002 → tx faz rollback → 409

    // 2. cria o PaymentIntent no Stripe
    // (fora da tx se possível -- I/O externo dentro de tx aumenta o tempo de lock)
    const intent = await this.paymentProvider.createIntent({
      amountInCents: event.priceInCents * seatIds.length,
      currency: 'BRL',
      metadata: { eventId, userId },
    })

    // 3. cria a Order
    const order = await this.orderRepo.create(tx, {
      userId, eventId, amountInCents: event.priceInCents * seatIds.length,
      stripePaymentIntentId: intent.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })

    // 4. vincula os holds ao order -- rastreabilidade (§4.6.2)
    await this.seatHoldRepo.linkToOrder(tx, { holdIds: holds.map(h => h.id), orderId: order.id })

    return { order, clientSecret: intent.clientSecret }
  })
}
```

**Regra sobre I/O externo dentro de transação:** o Stripe acima está fora da `$transaction`
por razão deliberada -- chamada HTTP externa dentro de uma transação aumenta o tempo de lock
e o risco de deadlock. O padrão correto é: abrir tx → escrever no banco → fechar tx →
chamar o externo → abrir nova tx se precisar registrar o resultado. Quando a ordem precisa
ser atomicamente criada junto com o PaymentIntent, a saída é a transação de compensação:
se o Stripe falhar depois do commit, um job reverter o `Order` para `FAILED`. Documentar
esse trade-off no README -- é exatamente o tipo de decisão que diferencia o projeto.

### 5.5.4 Erros -- uma hierarquia, um handler

Todos os erros de negócio herdam de `AppError`. O handler global no Express mapeia para
status HTTP. O Controller nunca decide o status -- o erro decide.

```ts
// shared/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusHint: number = 400,
  ) { super(message) }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} não encontrado`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super('FORBIDDEN', message, 403)
  }
}

export class InvalidTransitionError extends AppError {
  constructor(transition: string) {
    super('INVALID_TRANSITION', `Transição inválida: ${transition}`, 422)
  }
}
```

```ts
// middlewares/error.middleware.ts
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusHint).json({ code: err.code, message: err.message })
  }
  // P2002 do Prisma = unique constraint violation
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ code: 'CONFLICT', message: 'Recurso já existe ou em conflito' })
  }
  // nunca expor stack trace em produção
  const isProd = process.env.NODE_ENV === 'production'
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: isProd ? 'Erro interno' : (err as Error).message,
  })
}
```

Respostas de erro têm sempre a mesma forma: `{ code, message }`. O front trata por `code`,
não por status HTTP nem por texto da mensagem. Isso significa que renomear uma mensagem
não quebra nenhum `if` no cliente.

### 5.5.5 Variáveis de ambiente -- validadas na inicialização

`process.env.SUPABASE_URL` em produção sem a variável setada joga `undefined` silenciosamente
e o erro aparece só quando a rota é chamada. A solução é validar tudo na inicialização:

```ts
// config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:                z.enum(['development', 'test', 'production']),
  PORT:                    z.coerce.number().default(3000),
  TZ:                      z.literal('UTC'),
  DATABASE_URL:            z.string().url(),
  DIRECT_URL:              z.string().url(),
  JWT_ACCESS_SECRET:       z.string().min(32),
  JWT_REFRESH_SECRET:      z.string().min(32),
  JWT_QR_SECRET:           z.string().min(32),
  STRIPE_SECRET_KEY:       z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET:   z.string().startsWith('whsec_'),
  SUPABASE_URL:            z.string().url(),
  SUPABASE_SERVICE_ROLE:   z.string().min(20),
  TMDB_API_KEY:            z.string().min(10),
  GOOGLE_CLIENT_ID:        z.string().min(10),
  LOG_LEVEL:               z.enum(['fatal','error','warn','info','debug','trace']).default('info'),
})

export const env = envSchema.parse(process.env)
// lança ZodError com campo exato se algo faltar -- processo não sobe
```

`env` é importado de `config/env.ts` em todo lugar. `process.env` nunca aparece fora deste
arquivo. Qualquer variável faltando ou com formato errado mata o processo na inicialização
com uma mensagem clara -- em vez de uma exceção misteriosa 20 minutos depois de deployar.

`TZ: z.literal('UTC')` garante que o `TZ=UTC` do `.env` foi de fato carregado antes do
Prisma inicializar. Se não foi, o processo não sobe -- exatamente o comportamento correto.

### 5.5.6 Singleton do Prisma

```ts
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { env } from '../config/env'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

O padrão `globalThis` evita múltiplas instâncias em hot-reload de desenvolvimento -- sem
ele, cada salvamento de arquivo abre uma nova conexão com o banco até esgotar o pool.
Em serverless (Vercel), cada invocação é um processo novo, então o singleton é instanciado
uma vez por cold start -- comportamento correto para os dois ambientes.

### 5.5.7 Logging estruturado com request ID

`console.log` não é logging. É o que todo tutorial usa e o que nenhum sistema em produção
sustenta -- sem estrutura, sem correlação, sem nível, sem destino configurável.

**Por que Pino e não Winston:** Pino serializa JSON nativamente e é 5× mais rápido que
Winston em throughput de log. Em serverless (Vercel), onde cada invocação tem cold start,
isso importa. Winston tem mais plugins, mas para este projeto é complexidade sem retorno.
Registrar como decisão no README.

#### Setup

```ts
// lib/logger.ts
import pino from 'pino'
import { env } from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  // em desenvolvimento: pretty-print legível
  // em produção: JSON puro para ingestão por Datadog/Logtail/etc.
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
    : undefined,
  // campos que aparecem em todo log
  base: { service: 'ticketdev-api', env: env.NODE_ENV },
  // nunca logar timestamp como epoch -- ISO 8601 legível por humanos e ferramentas
  timestamp: pino.stdTimeFunctions.isoTime,
  // redact: campos que NUNCA devem aparecer em log, independente de quem logar
  redact: {
    paths: [
      'req.headers.authorization',  // JWT
      'req.headers.cookie',          // refresh token
      'body.password',
      'body.passwordHash',
      'body.cardNumber',             // nunca deveria chegar aqui -- mas por garantia
      '*.passwordHash',
      '*.stripePaymentIntentId',     // não é segredo, mas não agrega em log
    ],
    censor: '[REDACTED]',
  },
})
```

```ts
// config/env.ts -- adicionar ao schema existente
LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace']).default('info'),
```

#### Middleware de request ID

Cada requisição recebe um ID único que aparece em **todos** os logs relacionados a ela.
Sem isso, num ambiente com 50 requisições simultâneas, é impossível correlacionar o log
de entrada com o log de erro três camadas abaixo.

```ts
// middlewares/request-logger.middleware.ts
import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

// Estende o tipo do Express para carregar o logger filho
declare global {
  namespace Express {
    interface Request {
      id: string
      log: pino.Logger
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // ID único por requisição -- usar no header de resposta para debug no front
  req.id = (req.headers['x-request-id'] as string) ?? randomUUID()
  res.setHeader('x-request-id', req.id)

  // logger filho herda todos os campos do pai e adiciona o requestId
  req.log = logger.child({ requestId: req.id })

  const start = Date.now()

  req.log.info({
    msg: 'request received',
    method: req.method,
    url: req.url,                    // nunca req.originalUrl -- pode ter token na query
    userAgent: req.headers['user-agent'],
    // ip: req.ip -- cuidado com LGPD; logar só se necessário para segurança
  })

  res.on('finish', () => {
    const ms = Date.now() - start
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info'

    req.log[level]({
      msg: 'request completed',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: ms,
    })
  })

  next()
}
```

```ts
// app.ts -- ordem importa
app.use(requestLogger)   // primeiro: todo request tem ID antes de qualquer outro middleware
app.use(helmet())
app.use(cors(...))
app.use(express.json({ limit: '100kb' }))
// rotas...
app.use(errorHandler)    // último
```

#### Como usar nos Services e Repositories

O `req.log` está disponível no Controller. O Service **não** recebe `req` -- mas precisa
de contexto para logar. A solução é passar o logger como parâmetro, não importar o
singleton global dentro do Service:

```ts
// orders/orders.controller.ts
async createOrder(req: Request, res: Response) {
  const order = await this.orderService.createOrder(
    req.body,
    req.user.id,
    req.log,          // logger com requestId já embutido
  )
  res.status(201).json(order)
}

// orders/orders.service.ts
async createOrder(dto: CreateOrderDto, userId: string, log: pino.Logger) {
  log.info({ msg: 'creating order', userId, eventId: dto.eventId })

  try {
    const order = await prisma.$transaction(async (tx) => {
      // ...
      log.info({ msg: 'seat hold created', seatIds: dto.seatIds })
      // ...
      log.info({ msg: 'stripe payment intent created', intentId: intent.id })
      return order
    })

    log.info({ msg: 'order created', orderId: order.id, amountInCents: order.amountInCents })
    return order

  } catch (err) {
    // erro já vai aparecer no errorHandler -- aqui só logamos contexto adicional
    log.warn({ msg: 'order creation failed', userId, eventId: dto.eventId, err })
    throw err
  }
}
```

**Por que passar o logger como parâmetro e não importar o singleton:**
o singleton `logger` não tem `requestId`. Importar o singleton dentro do Service produziria
logs sem correlação -- exatamente o problema que o `requestId` resolve. Passar como
parâmetro mantém o contexto sem acoplar o Service ao Express.

#### O que logar em cada nível

| Nível | Quando usar | Exemplos |
|---|---|---|
| `fatal` | Processo vai morrer | Falha na conexão com o banco na inicialização |
| `error` | Erro inesperado, precisa de atenção humana | Exceção não tratada, falha no webhook |
| `warn` | Algo errado mas recuperável | Tentativa de validação de ingresso já usado, rate limit atingido |
| `info` | Fluxo normal de negócio | Order criada, ingresso validado, usuário autenticado |
| `debug` | Detalhe para troubleshooting | Query executada, resposta da API externa |
| `trace` | Detalhe máximo, nunca em produção | Cada passo de uma transação |

#### O que NUNCA logar (além do `redact`)

- Senha em qualquer forma (hash ou não)
- Refresh token ou access token completo -- no máximo os primeiros 8 chars para identificação
- Dados de cartão -- não devem nem chegar ao servidor (Stripe Elements tokeniza no browser)
- CPF, RG, data de nascimento -- LGPD; logar dado pessoal sensível sem necessidade é violação
- Stack trace completo em produção -- vai para o `error` do logger internamente, nunca na resposta HTTP
- Query string com parâmetros de autenticação -- `url: req.url` sem query string em rotas sensíveis

```ts
// shared/errors.ts -- errorHandler atualizado com logging
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    // AppError é erro de negócio esperado -- warn, não error
    req.log.warn({ msg: 'business error', code: err.code, statusHint: err.statusHint })
    return res.status(err.statusHint).json({ code: err.code, message: err.message })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    req.log.warn({ msg: 'unique constraint violation', prismaCode: err.code, meta: err.meta })
    return res.status(409).json({ code: 'CONFLICT', message: 'Recurso já existe ou em conflito' })
  }

  // qualquer outra coisa é erro inesperado -- error completo com stack
  req.log.error({ msg: 'unhandled error', err })

  const isProd = env.NODE_ENV === 'production'
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: isProd ? 'Erro interno' : (err as Error).message,
    // requestId no corpo: o front pode mostrar para o usuário copiar e reportar
    requestId: req.id,
  })
}
```

#### Logging do webhook do Stripe

O webhook é o único endpoint sem `req.log` disponível de forma limpa (chega antes do
body parser). Criar um logger filho diretamente:

```ts
// orders/webhook.controller.ts
export async function stripeWebhook(req: Request, res: Response) {
  const webhookLog = logger.child({
    requestId: req.id,
    handler: 'stripe-webhook',
    stripeEventId: null as string | null,  // preenchido após parse
  })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,                            // buffer raw -- não parsear como JSON antes
      req.headers['stripe-signature']!,
      env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    webhookLog.warn({ msg: 'webhook signature invalid', err })
    return res.status(400).json({ code: 'INVALID_SIGNATURE' })
  }

  webhookLog.bindings().stripeEventId = event.id
  webhookLog.info({ msg: 'webhook received', type: event.type })

  try {
    await webhookHandlers[event.type]?.(event, webhookLog)
    webhookLog.info({ msg: 'webhook processed' })
    res.json({ received: true })
  } catch (err) {
    webhookLog.error({ msg: 'webhook processing failed', type: event.type, err })
    // retornar 500 faz o Stripe retentar -- comportamento correto para falha transitória
    res.status(500).json({ code: 'PROCESSING_ERROR' })
  }
}
```

#### Adicionar ao `.env.example`

```bash
LOG_LEVEL=info   # desenvolvimento: debug | produção: info | silenciar testes: warn
```

#### Adicionar à estrutura de pastas (§5.5.1)

```
src/
├── lib/
│   ├── prisma.ts
│   ├── stripe.ts
│   └── logger.ts        # ← singleton Pino com redact e base fields
├── middlewares/
│   ├── request-logger.middleware.ts   # ← requestId + log de entrada/saída
│   ├── auth.middleware.ts
│   ├── validate.middleware.ts
│   └── error.middleware.ts            # ← atualizado para usar req.log
```

### 5.5.8 O que vai no README sobre arquitetura

Uma seção curta -- não um ensaio. A banca quer ver que as decisões foram feitas, não que
você sabe escrever sobre elas.

```markdown
## Arquitetura

Back-end organizado em módulos por domínio (auth, events, orders, tickets, catalog, gate).
Cada módulo tem três camadas: Controller (HTTP), Service (regra de negócio, transações),
Repository (Prisma). Controller não importa Repository; Service não importa Express.

Erros de negócio herdam de AppError -- o handler global mapeia para status HTTP.
O Controller nunca decide o status; o erro decide.

Variáveis de ambiente validadas com Zod na inicialização -- processo não sobe com variável
faltando ou malformada.

Logging com Pino: JSON estruturado em produção, pretty-print em desenvolvimento. Cada
requisição recebe um requestId (UUID) que aparece em todos os logs relacionados.
Dados sensíveis (senha, token, cookie) redactados automaticamente -- nunca aparecem em log.

Dinheiro em inteiros (centavos). Datas em UTC. Transições de estado validadas antes de
tocar o banco.

Repository pattern: isola o Prisma numa borda -- Service testável sem banco real.
```

---

### 5.6 Versionamento da API e paginação

Duas decisões de contrato que não existem no documento até agora e que aparecem em todo
controller de listagem. Definir antes de escrever o primeiro endpoint -- mudar depois
quebra clientes existentes.

#### 5.6.1 Versionamento -- `/api/v1/`

Não existe `/api/events`. Existe `/api/v1/events`.

Uma linha no router. O custo de não ter é muito maior que o custo de ter: se a banca
tentar integrar com a API depois e o contrato mudar, um `v2` resolve sem quebrar `v1`.
Mais importante: a ausência de versão é o tipo de coisa que aparece em code review de
sênior nos primeiros 30 segundos.

```ts
// app.ts
import { v1Router } from './routes/v1'

app.use('/api/v1', v1Router)
// health check fora do versionamento -- não é parte da API de negócio
app.get('/health', (_, res) => res.json({ status: 'ok', db: 'up' }))
```

```ts
// routes/v1/index.ts
import { Router } from 'express'
import { authRoutes }    from '../../modules/auth/auth.routes'
import { eventsRoutes }  from '../../modules/events/events.routes'
import { ordersRoutes }  from '../../modules/orders/orders.routes'
import { ticketsRoutes } from '../../modules/tickets/tickets.routes'
import { catalogRoutes } from '../../modules/catalog/catalog.routes'
import { gateRoutes }    from '../../modules/gate/gate.routes'

export const v1Router = Router()

v1Router.use('/auth',    authRoutes)
v1Router.use('/events',  eventsRoutes)
v1Router.use('/orders',  ordersRoutes)
v1Router.use('/tickets', ticketsRoutes)
v1Router.use('/catalog', catalogRoutes)
v1Router.use('/gate',    gateRoutes)
```

Rotas resultantes:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/google

GET    /api/v1/catalog/search?q=&source=
GET    /api/v1/catalog/:source/:externalId

GET    /api/v1/events?page=1&limit=20&q=&type=&from=&to=
POST   /api/v1/events
GET    /api/v1/events/:id
PATCH  /api/v1/events/:id
DELETE /api/v1/events/:id
GET    /api/v1/events/:id/seatmap

POST   /api/v1/events/:id/holds
DELETE /api/v1/events/:eventId/holds/:holdId

POST   /api/v1/orders
GET    /api/v1/orders/:id

GET    /api/v1/tickets
GET    /api/v1/tickets/:id
GET    /api/v1/tickets/:id/share    → gera/retorna shareToken

GET    /api/v1/share/:shareToken    → página pública do ingresso (sem auth)

POST   /api/v1/gate/validate        → { code } ou { ticketId }

GET    /health
```

**Verbos HTTP semânticos** -- registrar no README:
- `POST` cria. `GET` lê. `PATCH` atualiza parcialmente (não `PUT` -- não substitui o
  recurso inteiro). `DELETE` remove.
- `POST /api/v1/gate/validate` em vez de `GET` porque a validação é uma ação com efeito
  colateral (`usedAt` preenchido) -- `GET` é idiomaticamente sem efeito colateral.

#### 5.6.2 Paginação -- offset/page

**Decisão: offset/page** (`?page=1&limit=20`). Adequado para listagem de eventos onde
o usuário quer navegar por página e saber o total. Cursor seria correto para feed de
atividade em tempo real -- não é o caso aqui. Registrar no README.

**Contrato de resposta paginada -- definido uma vez, usado em todo endpoint de listagem:**

```ts
// shared/pagination.ts

export interface PaginationQuery {
  page:  number   // ≥ 1, default 1
  limit: number   // 1–100, default 20
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page:       number   // página atual
    limit:      number   // itens por página
    total:      number   // total de itens (para "página X de Y" no front)
    totalPages: number   // Math.ceil(total / limit)
    hasNext:    boolean  // page < totalPages
    hasPrev:    boolean  // page > 1
  }
}

// helper que monta o meta a partir de { page, limit, total }
export function paginate<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationQuery,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit)
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}
```

**Schema Zod para query de paginação** -- validado no middleware antes de chegar ao controller:

```ts
// shared/pagination.ts (continuação)
import { z } from 'zod'

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
// z.coerce.number() porque query params chegam como string -- "20" → 20
```

**Schema completo de busca de eventos** -- combina paginação com filtros:

```ts
// events/events.schema.ts
import { z } from 'zod'
import { paginationSchema } from '../../shared/pagination'

export const listEventsSchema = z.object({
  query: paginationSchema.extend({
    q:      z.string().max(100).optional(),          // busca por título
    type:   z.literal('SEATED').optional(),   // apenas SEATED nesta versão
    source: z.literal('TMDB').optional(),       // apenas TMDb nesta versão
    from:   z.coerce.date().optional(),              // eventos a partir de
    to:     z.coerce.date().optional(),              // eventos até
    status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  }).refine(
    data => !data.from || !data.to || data.from <= data.to,
    { message: '`from` deve ser anterior a `to`', path: ['from'] }
  ),
})

export type ListEventsQuery = z.infer<typeof listEventsSchema>['query']
```

**Repository com `findMany` + `count` em paralelo** -- nunca sequencial:

```ts
// events/events.repository.ts
async findMany(
  tx: PrismaClient,
  filters: ListEventsQuery,
): Promise<{ data: Event[]; total: number }> {
  const where = {
    status:    filters.status,
    type:      filters.type,
    source:    filters.source,
    startsAt:  {
      gte: filters.from,
      lte: filters.to,
    },
    title: filters.q
      ? { contains: filters.q, mode: 'insensitive' as const }
      : undefined,
  }

  // findMany e count em PARALELO -- não sequencial
  // sequencial: 2× o tempo de roundtrip ao banco
  const [data, total] = await Promise.all([
    tx.event.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip:  (filters.page - 1) * filters.limit,
      take:  filters.limit,
      include: {
        organizer: { select: { id: true, name: true } },
        _count:    { select: { tickets: true } },
      },
    }),
    tx.event.count({ where }),
  ])

  return { data, total }
}
```

**Controller montando a resposta:**

```ts
// events/events.controller.ts
async listEvents(req: Request, res: Response) {
  const { query } = listEventsSchema.parse({ query: req.query })

  const { data, total } = await this.eventsService.listEvents(query, req.log)

  return res.json(paginate(data, total, query))
}
```

**Resposta final que o front recebe:**

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Coldplay World Tour",
      "type": "SEATED",
      "source": "TMDB",
      "startsAt": "2026-08-23T00:00:00.000Z",
      "timezone": "America/Sao_Paulo",
      "priceInCents": 18000,
      "status": "PUBLISHED",
      "organizer": { "id": "usr...", "name": "João Silva" },
      "_count": { "tickets": 142 }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 87,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

`_count.tickets` no payload evita um segundo request do front para saber quantos ingressos
foram vendidos -- informação útil para o card de evento ("142 ingressos vendidos").

**O `total` vem do banco, não do `data.length`** -- `data.length` é sempre ≤ `limit`, o
que tornaria "página X de Y" impossível de calcular no front.

#### 5.6.3 Adicionar à estrutura de pastas (§5.5.1)

```
src/
├── shared/
│   ├── errors.ts
│   ├── money.ts
│   ├── date.ts
│   └── pagination.ts    # ← PaginatedResponse, paginate(), paginationSchema
├── routes/
│   └── v1/
│       └── index.ts     # ← monta todos os módulos sob /api/v1
```

#### 5.6.4 O que vai no README sobre API

```markdown
## API

Base URL: `/api/v1`

Todas as respostas de listagem seguem o contrato paginado:
`{ data: T[], meta: { page, limit, total, totalPages, hasNext, hasPrev } }`

Parâmetros de paginação: `?page=1&limit=20` (limit máximo: 100).

Erros seguem `{ code: string, message: string }`. Em erros 500,
o campo `requestId` permite rastrear o erro nos logs.

Exemplos de uso nas seções de cada módulo abaixo.
```

---

## 6. Requisitos Não Funcionais

- **Prazo:** 7 dias corridos a partir do recebimento do desafio.
- **Documentação:** README detalhado com o passo a passo para configurar e executar a aplicação.
  Se algo não estiver funcionando como esperado, **isso deve constar no README** -- ausência de
  explicações impacta negativamente a nota.
- **Dados de teste (seed):** deixar semeados
  - [ ] 1 organizador
  - [ ] 2 clientes
  - [ ] 1 usuário de portaria
  - [ ] ao menos 1 evento publicado com ingressos disponíveis
  - [ ] **1 sessão de filme** com mapa de assentos (alguns assentos já vendidos, para o
        mapa não parecer vazio no momento da avaliação)
  - [ ] 1 ingresso já pago e **1 ingresso já validado**, para a portaria demonstrar o caso
        "já utilizado" sem precisar de dois passes pelo fluxo
- **Deploy:** não obrigatório, mas **vale +1 ponto na nota final** (Vercel ou plataforma similar).
  Vantagem adicional: a banca vê funcionando antes de ler o código. Reforço: **a leitura de QR
  pela câmera exige HTTPS**, então sem deploy esse requisito só é demonstrável em `localhost`.
- **Testes (Vitest nas duas pontas):** cobrir prioritariamente o que a banca vai olhar --
  anti-double-booking sob concorrência, anti-double-validation, assinatura do QR e RBAC.
  Cobertura ampla vale menos que estes quatro testes existindo e passando.

---

## 7. Segurança e autenticação

Requisito ampliado em relação ao PDF. O que precisa existir:

### 7.1 Senhas e dados sensíveis
- [ ] Hash de senha com **argon2id** (preferência) ou **bcrypt** com cost ≥ 12. Nunca MD5/SHA
      puro, nunca criptografia reversível.
- [ ] Comparação em tempo constante; resposta de login **idêntica** para "e-mail não existe" e
      "senha errada" (evita enumeração de usuários).
- [ ] Política mínima de senha (≥ 10 caracteres) validada no servidor, não só no front.
- [ ] Nenhum dado sensível em log -- nem senha, nem token, nem payload do Stripe.
- [ ] Sem armazenamento de dado de cartão: o número **nunca** toca o back-end (Stripe Elements
      tokeniza no browser). Registrar isso no README como decisão de segurança consciente.

### 7.2 JWT
- [ ] **Access token** curto (15 min) + **refresh token** longo (7 dias) com rotação.
- [ ] Refresh token em **cookie `httpOnly` + `Secure` + `SameSite=Lax`**, persistido no banco
      **em hash** para permitir revogação e detecção de reuso.
- [ ] Payload mínimo: `sub`, `role`, `jti`, `exp`, `iat`. Nada de dado pessoal no token -- ele é
      apenas assinado, não criptografado, e qualquer um lê o conteúdo.
- [ ] Algoritmo explícito na verificação (`algorithms: ['HS256']`) -- não aceitar o que vier no
      header `alg` (`alg: none` é ataque clássico).
- [ ] Segredos distintos e independentes para: access token, refresh token e **assinatura do QR**.
- [ ] Logout invalida o refresh token no servidor.

### 7.3 Login com Google -- e por que não usar o Supabase Auth

O Supabase Auth resolveria isso em um dia: provider Google no painel, hash de senha por conta da
plataforma, JWT emitido por eles. A tentação é real, e a decisão precisa ser explicada.

**Decisão: autenticação própria na API Express. Supabase Auth fica de fora.**

| | Supabase Auth | Auth própria (escolhida) |
|---|---|---|
| Velocidade | dias a menos | mais código |
| O que demonstra | configuração de painel | argon2, JWT, refresh rotation, RBAC |
| Papéis (3 do desafio) | exige custom claims + hook, ou tabela `profiles` espelhada | coluna `role` na própria tabela `User` |
| Fonte da verdade | `auth.users` (schema gerenciado) + tabela espelho | uma tabela só |
| Requisito do projeto | "JWT, hash de senha" viraria responsabilidade da plataforma | atendido diretamente |

Os dois motivos que pesam: (1) o desafio pede explicitamente JWT e criptografia de senha --
terceirizar isso remove justamente o que estaria sendo avaliado; (2) `auth.users` num schema
gerenciado obriga a manter uma tabela espelho em `public` sincronizada por trigger, e passa a
existir *duas* noções de usuário. Para três papéis simples, é complexidade sem retorno.

> Registrar isso no README como decisão consciente, não como desconhecimento da ferramenta --
> "tinha Supabase Auth disponível e escolhi não usar, por isso" é exatamente o tipo de raciocínio
> que a §3 pede.

**Fluxo do Google, então, sem intermediário:**

- [ ] Front: **Google Identity Services** (`@react-oauth/google` ou o script oficial) devolve um
      `credential` (ID token JWT do Google).
- [ ] Back: verificar com **`google-auth-library`** (`verifyIdToken`, conferindo `aud` = seu client
      ID e `iss` = `accounts.google.com`) → emitir **os seus próprios** JWTs. O token do Google
      não circula como credencial da API depois disso.
- [ ] Vinculação de conta: se o e-mail do Google já existir com senha, **vincular** ao usuário
      existente (não criar duplicata) e só quando `email_verified === true`.
- [ ] Usuário criado via Google entra como **Cliente**. Papéis de Organizador e Portaria são
      concedidos administrativamente / via seed -- nunca escolhidos no cadastro. Isso é decisão
      de segurança, vale explicar no README.

### 7.4 Validação de e-mail
- [ ] Formato real aceitando `email@dominio.com`, `email@dominio.com.br` e TLDs compostos:
      validar com **Zod `.email()`** e uma checagem adicional de domínio (TLD ≥ 2 caracteres,
      sem pontos consecutivos, sem ponto no fim). Não escrever regex artesanal de e-mail -- é
      onde todo mundo erra.
- [ ] Normalizar antes de salvar (`trim` + `toLowerCase`) e `@unique` no schema.
- [ ] Confirmação de e-mail: **fora de escopo** -- o PDF dispensa envio de e-mail. Marcar o campo
      `emailVerified` como `true` para contas Google e `false` para senha, documentando que o
      fluxo de confirmação foi deliberadamente omitido.

### 7.5 Autorização (RBAC)
- [ ] Middleware `requireAuth` + `requireRole('ORGANIZER' | 'CUSTOMER' | 'GATE')`.
- [ ] **Ownership**: organizador só edita evento que ele criou; cliente só vê ingresso que é dele.
      Checar no banco, não confiar no id que vem no corpo da requisição (IDOR).
- [ ] Rota de validação de ingresso exige papel **Portaria** e o evento deve estar vinculado a ela
      (caso "evento errado" do FE-6 nasce daí).
- [ ] Teste automatizado por rota sensível: cliente tentando criar evento → 403.

### 7.6 QR não forjável
- [ ] Código = identificador opaco aleatório (32 bytes, `crypto.randomBytes`) **+ assinatura HMAC**
      sobre `{ticketId, eventId, jti}`. Assim a portaria detecta forjadura antes de ir ao banco, e
      o banco decide sobre reuso.
- [ ] Guardar no banco apenas o **hash** do código (mesmo raciocínio de senha): dump do banco não
      permite fabricar ingresso válido.
- [ ] Validação atômica -- uma instrução, sem `SELECT` seguido de `UPDATE`:
      ```sql
      UPDATE "Ticket" SET "usedAt" = now(), "validatedBy" = $gateUserId
       WHERE id = $id AND "usedAt" IS NULL
      RETURNING *;
      ```
      `rowCount === 0` → **já utilizado**. Resolve o BE-7 sem lock explícito.
- [ ] Registrar toda tentativa de validação (sucesso e falha) numa tabela de auditoria com
      horário, operador e resultado.

### 7.7 Link de compartilhamento
- [ ] Token separado, de leitura, com escopo próprio e expiração -- **não** o mesmo token do QR.
- [ ] A página compartilhada expõe o mínimo: evento, assento, QR. **Sem** nome, e-mail ou
      histórico de quem comprou.
- [ ] Revogável pelo dono, e o link não permite transferir titularidade (revenda está fora de escopo).
- [ ] Documentar a semântica escolhida: quem chegar primeiro com o QR entra. É a regra do mundo
      real e evita prometer garantia que o sistema não dá.

### 7.8 Superfície da API
- [ ] **Helmet** (headers de segurança) + **CORS** com allowlist explícita -- nunca `origin: '*'`
      junto com credenciais.
- [ ] **Rate limit** global e um mais agressivo em login, cadastro, refresh e validação de ingresso
      (`express-rate-limit`).
- [ ] **Zod** validando todo input (body, params, query) na borda; nada de `req.body` cru chegando
      ao Prisma.
- [ ] Limite de tamanho de payload (`express.json({ limit: '100kb' })`) e de upload.
- [ ] Erros padronizados: `{ code, message }`, sem stack trace nem mensagem do banco em produção.
- [ ] `.env` no `.gitignore`, `.env.example` versionado. Zero segredo no histórico do Git -- se
      vazar, rotacionar, não só remover no commit seguinte.
- [ ] Prisma como defesa contra SQL injection; se houver `$queryRaw`, obrigatoriamente parametrizado.
- [ ] Dependências: `npm audit` antes de entregar.

### 7.9 RLS: o banco passa a ter duas portas

Consequência direta de usar o Realtime. O Postgres deixa de ser acessível só pela API:

```
Porta 1  Front → Express (JWT próprio) → Prisma → Postgres
         Prisma conecta como dono do banco: RLS é IGNORADO.
         Autorização = middlewares de §7.5. Sem eles, não há proteção nenhuma.

Porta 2  Front → Supabase Realtime (anon key) → Postgres
         RLS é a ÚNICA proteção. Sem política, a anon key lê tudo o que estiver exposto.
```

Isso é onde um projeto com Supabase costuma vazar dado sem perceber: alguém habilita RLS achando
que protege a API (não protege -- o Prisma passa por cima) ou esquece RLS achando que a API é a
única porta (não é -- a anon key está no bundle do front).

- [ ] **`ENABLE ROW LEVEL SECURITY` em todas as tabelas.** O default do Postgres é aberto; sem
      isso, a `anon key` lê qualquer tabela publicada na replicação.
- [ ] Publicar no Realtime **apenas** a `seat_state` (§4.4.2). Nenhuma tabela com dado pessoal
      (`User`, `Ticket`, `Order`, `SeatHold`) entra na publicação.
- [ ] Política de leitura pública **só** em `seat_state`:
      ```sql
      ALTER TABLE seat_state ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "seat_state_public_read" ON seat_state
        FOR SELECT TO anon USING (true);
      -- nenhuma política de INSERT/UPDATE/DELETE para anon: escrita só pela API
      ```
- [ ] Verificar na prática: com a `anon key` no console do navegador, tentar `select('*')` em
      `User` e em `Ticket`. Deve voltar vazio ou erro. **Fazer esse teste antes de entregar** e
      registrar o resultado no README.

---

### 7.10 Estratégia de testes

Duas camadas, ferramentas diferentes, propósitos diferentes. A confusão mais comum é tentar
testar tudo da mesma forma -- ou mockar o banco quando deveria usar o real, ou usar o banco
real quando um mock seria mais rápido e mais preciso.

### 7.10.1 O que vai em cada camada

| O que testar | Camada | Banco real? | Ferramenta |
|---|---|---|---|
| Regra de negócio do Service (transições, cálculos, fluxo) | Unitário | ❌ mock do Repository | Vitest |
| Queries do Repository (índices, constraints, concurrent writes) | Integração | ✅ Postgres de teste | Vitest |
| Endpoints HTTP (autenticação, autorização, contratos) | Integração | ✅ Postgres de teste | Vitest + Supertest |
| Concorrência (double-booking, double-validation) | Integração | ✅ Postgres de teste | Vitest |
| Componentes React (render, interação) | Unitário | ❌ | Vitest + Testing Library |
| Fluxo completo de usuário | E2E | ✅ ambiente completo | Playwright (opcional) |

Playwright fica fora do escopo dos 7 dias -- documentar como descartado, não como esquecido.

### 7.10.2 Setup -- dois ambientes de banco

```
# .env.test  (nunca versionado -- apenas .env.test.example)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketdev_test?pgbouncer=false"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/ticketdev_test"
TZ="UTC"
JWT_ACCESS_SECRET="test-access-secret-32-characters-min"
JWT_REFRESH_SECRET="test-refresh-secret-32-characters-min"
JWT_QR_SECRET="test-qr-secret-32-characters-minimum"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_test_..."
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // carrega .env.test antes de cada suite
    setupFiles: ['./src/test/setup.ts'],
    // separa unitários de integração por pasta
    // rodar os dois: vitest
    // só unitários: vitest run --project unit
    // só integração: vitest run --project integration
    projects: [
      {
        name: 'unit',
        test: {
          include: ['src/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        name: 'integration',
        test: {
          include: ['src/**/*.integration.test.ts'],
          environment: 'node',
          // integração roda em série -- evita conflito de dados
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
})
```

```ts
// src/test/setup.ts
import { prisma } from '../lib/prisma'
import { execSync } from 'child_process'

// antes de toda a suite: aplica migrations no banco de teste
beforeAll(async () => {
  execSync('prisma migrate deploy', { env: { ...process.env } })
})

// antes de cada teste de integração: limpa as tabelas na ordem certa
// (respeita foreign keys -- não pode truncar em qualquer ordem)
export async function cleanDatabase() {
  await prisma.$transaction([
    prisma.validationLog.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.seatHold.deleteMany(),
    prisma.order.deleteMany(),
    prisma.seat.deleteMany(),
    prisma.event.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
```

### 7.10.3 Testes unitários do Service -- mock do Repository

O Service recebe o Repository por injeção. Em teste, passa um mock.

```ts
// orders/orders.service.unit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrderService } from './orders.service'
import { OrderStatus } from '@prisma/client'
import { InvalidTransitionError } from '../../shared/errors'

// factory que cria uma Order fake com defaults sensatos
const makeOrder = (overrides = {}) => ({
  id: 'order-1',
  userId: 'user-1',
  eventId: 'event-1',
  status: OrderStatus.PENDING,
  amountInCents: 18000,
  currency: 'BRL',
  stripePaymentIntentId: 'pi_test_123',
  createdAt: new Date(),
  updatedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  ...overrides,
})

describe('OrderService', () => {
  let orderRepo: ReturnType<typeof makeMockOrderRepo>
  let seatHoldRepo: ReturnType<typeof makeMockSeatHoldRepo>
  let paymentProvider: ReturnType<typeof makeMockPaymentProvider>
  let service: OrderService

  function makeMockOrderRepo() {
    return {
      create: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    }
  }
  function makeMockSeatHoldRepo() {
    return { createMany: vi.fn(), linkToOrder: vi.fn(), releaseByOrderId: vi.fn() }
  }
  function makeMockPaymentProvider() {
    return { createIntent: vi.fn(), refund: vi.fn() }
  }

  beforeEach(() => {
    orderRepo = makeMockOrderRepo()
    seatHoldRepo = makeMockSeatHoldRepo()
    paymentProvider = makeMockPaymentProvider()
    service = new OrderService(orderRepo, seatHoldRepo, paymentProvider)
  })

  describe('confirmPayment', () => {
    it('transita PENDING → PAID e emite ingresso', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING })
      orderRepo.findById.mockResolvedValue(order)
      orderRepo.updateStatus.mockResolvedValue({ ...order, status: OrderStatus.PAID })

      await service.confirmPayment('order-1')

      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        expect.anything(), // tx
        'order-1',
        OrderStatus.PAID,
      )
    })

    it('lança InvalidTransitionError se Order já estiver PAID', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }))

      await expect(service.confirmPayment('order-1'))
        .rejects.toThrow(InvalidTransitionError)

      // idempotência: updateStatus não foi chamado
      expect(orderRepo.updateStatus).not.toHaveBeenCalled()
    })

    it('lança InvalidTransitionError se Order estiver EXPIRED', async () => {
      orderRepo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.EXPIRED }))
      await expect(service.confirmPayment('order-1')).rejects.toThrow(InvalidTransitionError)
    })
  })

  describe('handlePaymentFailed', () => {
    it('transita PENDING → FAILED e libera os assentos', async () => {
      const order = makeOrder({ status: OrderStatus.PENDING })
      orderRepo.findById.mockResolvedValue(order)
      orderRepo.updateStatus.mockResolvedValue({ ...order, status: OrderStatus.FAILED })

      await service.handlePaymentFailed('order-1')

      expect(orderRepo.updateStatus).toHaveBeenCalledWith(expect.anything(), 'order-1', OrderStatus.FAILED)
      expect(seatHoldRepo.releaseByOrderId).toHaveBeenCalledWith(expect.anything(), 'order-1')
    })
  })
})
```

Esses testes não sobem banco, não chamam Stripe, rodam em milissegundos. Cobrem exatamente
o que importa: a lógica de transição e a idempotência -- que são as duas propriedades mais
difíceis de garantir sem teste.

### 7.10.4 Testes de integração -- os quatro que a banca vai procurar

Estes precisam de Postgres real. Cada um cobre um requisito que não tem como testar com mock.

**1. Anti-double-booking (assento marcado)**

```ts
// seats/seat-booking.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { cleanDatabase } from '../../test/setup'
import { prisma } from '../../lib/prisma'
import { SeatHoldRepository } from '../seats/seat-hold.repository'
import { seedEventWithSeats } from '../../test/factories'

describe('anti-double-booking -- assento marcado', () => {
  beforeEach(cleanDatabase)

  it('N requisições concorrentes no mesmo assento: exatamente 1 sucesso', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 10 })
    const targetSeat = seats[0]
    const repo = new SeatHoldRepository(prisma)

    const CONCURRENCY = 20
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        prisma.$transaction(tx =>
          repo.createMany(tx, {
            eventId: event.id,
            seatIds: [targetSeat.id],
            userId: `user-${i}`,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          })
        )
      )
    )

    const successes = results.filter(r => r.status === 'fulfilled')
    const failures  = results.filter(r => r.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(CONCURRENCY - 1)
    // todas as falhas são P2002 (unique constraint) -- não erro genérico
    failures.forEach(f => {
      expect((f as PromiseRejectedResult).reason?.code).toBe('P2002')
    })
  })

  it('N requisições concorrentes em assentos distintos: todos os N com sucesso', async () => {
    const { event, seats } = await seedEventWithSeats({ seatCount: 10 })
    const repo = new SeatHoldRepository(prisma)

    const results = await Promise.allSettled(
      seats.map((seat, i) =>
        prisma.$transaction(tx =>
          repo.createMany(tx, {
            eventId: event.id,
            seatIds: [seat.id],
            userId: `user-${i}`,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          })
        )
      )
    )

    expect(results.every(r => r.status === 'fulfilled')).toBe(true)
  })
})
```

**2. Anti-double-booking (setor por quantidade)**

```ts
// sections/section-booking.integration.test.ts
describe('anti-double-booking -- setor por quantidade', () => {
  beforeEach(cleanDatabase)

  it('requisições concorrentes não vendem além da capacidade', async () => {
    const CAPACITY = 5
    const CONCURRENCY = 20
    const section = await prisma.section.create({
      data: { eventId: 'event-1', name: 'Pista', capacity: CAPACITY, reserved: 0 },
    })

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        prisma.$executeRaw`
          UPDATE "Section"
          SET reserved = reserved + 1
          WHERE id = ${section.id}
            AND capacity - reserved >= 1
        `
      )
    )

    const final = await prisma.section.findUniqueOrThrow({ where: { id: section.id } })
    // nunca ultrapassa a capacidade, independente de concorrência
    expect(final.reserved).toBeLessThanOrEqual(CAPACITY)
    expect(final.reserved).toBeGreaterThan(0)
  })
})
```

**3. Anti-double-validation**

```ts
// gate/gate-validation.integration.test.ts
describe('anti-double-validation', () => {
  beforeEach(cleanDatabase)

  it('N validações concorrentes do mesmo ingresso: exatamente 1 sucesso', async () => {
    const ticket = await seedPaidTicket()
    const CONCURRENCY = 10

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        prisma.$executeRaw`
          UPDATE "Ticket"
          SET "usedAt" = now(), "validatedById" = ${'gate-user-' + i}
          WHERE id = ${ticket.id}
            AND "usedAt" IS NULL
        `
      )
    )

    // exatamente 1 linha afetada no total entre todas as queries
    const affected = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<number>).value)
    
    expect(affected.filter(n => n === 1)).toHaveLength(1)
    expect(affected.filter(n => n === 0)).toHaveLength(CONCURRENCY - 1)
  })
})
```

**4. Assinatura do QR -- não forjável**

```ts
// tickets/qr-signature.unit.test.ts
import { describe, it, expect } from 'vitest'
import { generateTicketCode, verifyTicketCode } from '../tickets/qr.service'

describe('QR -- não forjável', () => {
  it('código gerado é verificado com sucesso', () => {
    const code = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    expect(verifyTicketCode(code, { ticketId: 't-1', eventId: 'e-1' })).toBe(true)
  })

  it('código adulterado é rejeitado', () => {
    const code = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const tampered = code.slice(0, -4) + 'XXXX'
    expect(verifyTicketCode(tampered, { ticketId: 't-1', eventId: 'e-1' })).toBe(false)
  })

  it('código válido para evento errado é rejeitado', () => {
    const code = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    expect(verifyTicketCode(code, { ticketId: 't-1', eventId: 'e-OUTRO' })).toBe(false)
  })

  it('dois ingressos diferentes geram códigos diferentes', () => {
    const a = generateTicketCode({ ticketId: 't-1', eventId: 'e-1' })
    const b = generateTicketCode({ ticketId: 't-2', eventId: 'e-1' })
    expect(a).not.toBe(b)
  })
})
```

### 7.10.5 Testes de endpoint -- contratos e autorização

```ts
// events/events.controller.integration.test.ts
import request from 'supertest'
import { app } from '../../app'
import { signAccessToken } from '../auth/token.service'
import { Role } from '@prisma/client'

describe('POST /events', () => {
  beforeEach(cleanDatabase)

  it('201 -- organizador cria evento com dados válidos', async () => {
    const token = signAccessToken({ sub: 'org-1', role: Role.ORGANIZER })
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Show Teste',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'America/Sao_Paulo',
        priceInCents: 18000,
        venueId: 'venue-1',
        type: 'GENERAL_ADMISSION',
      })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: expect.any(String), priceInCents: 18000 })
  })

  it('403 -- cliente não pode criar evento', async () => {
    const token = signAccessToken({ sub: 'customer-1', role: Role.CUSTOMER })
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tentativa' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('403 -- portaria não pode criar evento', async () => {
    const token = signAccessToken({ sub: 'gate-1', role: Role.GATE })
    const res = await request(app).post('/events').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('401 -- sem token', async () => {
    const res = await request(app).post('/events').send({ title: 'Sem token' })
    expect(res.status).toBe(401)
  })

  it('400 -- dados inválidos (preço negativo)', async () => {
    const token = signAccessToken({ sub: 'org-1', role: Role.ORGANIZER })
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Show', priceInCents: -100 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})
```

O padrão "4 casos por rota sensível": sucesso, papel errado (todos os outros papéis),
sem token, dados inválidos. Não precisa testar cada combinação -- precisa testar que as
fronteiras existem e estão no lugar certo.

### 7.10.6 GitHub Actions -- CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ticketdev_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    env:
      NODE_ENV: test
      TZ: UTC
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ticketdev_test
      DIRECT_URL: postgresql://postgres:postgres@localhost:5432/ticketdev_test
      JWT_ACCESS_SECRET: ci-access-secret-32-characters-xx
      JWT_REFRESH_SECRET: ci-refresh-secret-32-characters-xx
      JWT_QR_SECRET: ci-qr-secret-32-characters-minimum-x
      # Stripe em modo de teste -- chave pública, sem risco
      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY_TEST }}
      STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET_TEST }}
      # TMDb mockado com MSW -- CI não faz chamadas reais
      TMDB_API_KEY: msw-placeholder
      GOOGLE_CLIENT_ID: msw-placeholder.apps.googleusercontent.com

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Instalar dependências
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Migrations
        run: npx prisma migrate deploy
        working-directory: ./backend

      - name: Testes unitários
        run: npm run test:unit
        working-directory: ./backend

      - name: Testes de integração
        run: npm run test:integration
        working-directory: ./backend

      - name: Testes do front-end
        run: npm run test
        working-directory: ./frontend
```

```json
// backend/package.json -- scripts relevantes
{
  "scripts": {
    "test":            "vitest run",
    "test:unit":       "vitest run --project unit",
    "test:integration":"vitest run --project integration",
    "test:watch":      "vitest",
    "typecheck":       "tsc --noEmit",
    "lint":            "eslint src --ext .ts"
  }
}
```

### 7.10.7 APIs externas -- MSW para não bater nos limites de rate

TMDb tem rate limit. Bater nele em cada execução de CI vai:
(a) falhar de forma intermitente quando a key estiver sem cota, e
(b) expor a key no ambiente de CI sem necessidade.

A solução é **Mock Service Worker (MSW)** interceptando as chamadas HTTP no nível de rede --
o código chama `fetch` normalmente, o MSW intercepta antes de sair da máquina.

```ts
// src/test/msw/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('https://api.themoviedb.org/3/search/movie', () =>
    HttpResponse.json({
      results: [
        { id: 550, title: 'Fight Club', overview: 'Um homem...', poster_path: '/poster.jpg',
          release_date: '1999-10-15', genre_ids: [18] },
      ],
      total_results: 1, total_pages: 1,
    })
  ),

]
```

```ts
// src/test/setup.ts  (complemento)
import { setupServer } from 'msw/node'
import { handlers } from './msw/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

`onUnhandledRequest: 'error'` é importante: qualquer chamada HTTP que o teste fizer e que
não tiver handler vai lançar erro. Isso evita que um teste chame acidentalmente uma API
real em CI sem que você perceba.

### 7.10.8 Factories de teste

Seed de teste não é o mesmo que seed de desenvolvimento. Factories criam o mínimo necessário
para o teste -- sem dados extras que mascaram o que está sendo testado.

```ts
// src/test/factories.ts
import { prisma } from '../lib/prisma'
import { Role, OrderStatus, TicketStatus } from '@prisma/client'
import { hashPassword } from '../modules/auth/password.service'

export async function seedUser(overrides: Partial<{ role: Role; email: string }> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${Date.now()}@test.com`,
      passwordHash: await hashPassword('Test@12345'),
      role: overrides.role ?? Role.CUSTOMER,
      emailVerified: false,
    },
  })
}

export async function seedEventWithSeats(opts: { seatCount: number }) {
  const organizer = await seedUser({ role: Role.ORGANIZER })
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Evento de Teste',
      type: 'SEATED',
      startsAt: new Date(Date.now() + 86400000), // amanhã
      timezone: 'America/Sao_Paulo',
      priceInCents: 18000,
      currency: 'BRL',
      status: 'PUBLISHED',
    },
  })
  const seats = await Promise.all(
    Array.from({ length: opts.seatCount }, (_, i) =>
      prisma.seat.create({
        data: { eventId: event.id, row: 'A', number: i + 1, kind: 'REGULAR' },
      })
    )
  )
  return { organizer, event, seats }
}

export async function seedPaidTicket() {
  const { event, seats } = await seedEventWithSeats({ seatCount: 1 })
  const customer = await seedUser({ role: Role.CUSTOMER })
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      eventId: event.id,
      status: OrderStatus.PAID,
      amountInCents: 18000,
      currency: 'BRL',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  })
  return prisma.ticket.create({
    data: {
      orderId: order.id,
      eventId: event.id,
      seatId: seats[0].id,
      status: TicketStatus.ACTIVE,
      codeHash: 'hash-de-teste-' + Date.now(),
    },
  })
}
```

Factories compõem -- `seedPaidTicket` chama `seedEventWithSeats` que chama `seedUser`.
Cada teste chama só o que precisa e tem o estado mínimo para o cenário.

---

## 8. Opcionais (não obrigatórios, mas avaliados)

- [x] Busca e filtro de eventos → **incluído** (FE-1)
- [x] Painel do organizador → **incluído** (FE-2)
- [ ] Cancelamento com devolução ao estoque
- [x] Mapa de assentos em tempo real → **incluído** (FE-8 / §4.4) -- modo SEATED (filmes)
- [ ] Docker Compose → **decisão postergada** (§5.4)
- [x] Testes → **incluído** (Vitest nas duas pontas)
- [ ] Aplicação publicada (+1 ponto)

## 9. Fora de escopo (não fazer)

- Nota fiscal
- Revenda entre usuários
- Aplicativo nativo
- Recuperação de senha
- Envio de ingresso por e-mail
- Confirmação de e-mail por link (consequência do item acima -- ver §7.4)

---

## 10. Uso de IA

O uso de IA é **recomendado** e não retira pontos -- usar bem é uma habilidade valorizada.

Entregáveis esperados sobre isso:

- [ ] Relatar **quais ferramentas** foram usadas, **em que partes** do projeto e **o que foi feito sem IA**
      (seção no README, arquivo dedicado, ou formato à escolha).
- [ ] **Versionar artefatos** produzidos no caminho: specs, PRD, fluxo BMAD, arquivos de contexto.
      Mostrar como a ferramenta foi conduzida conta a favor.
- [ ] **Este documento é um desses artefatos** -- versionar em `/docs` com o histórico de revisões.
      Ele mostra requisito sendo lido, questionado e decidido, que é exatamente o que a §3 pede.

Racional da banca: explicar o processo defende escolhas que, sem contexto, poderiam ser mal
interpretadas numa leitura rápida.

---

## 11. Entrega

- **Repositório GitHub público**, com código versionado.
- **Commits ao longo da semana**, com mensagens descritivas -- o histórico mostra o processo.
- **Envio:** link do repositório pelo formulário em `elitedev.verzel.com.br`, indicando onde o
  código foi publicado e como executá-lo.

---

## 12. Dica oficial e diferenciais

**Estratégia recomendada:** fazer o básico rodar **de ponta a ponta** e só depois agregar valor.
A banca prefere o fluxo inteiro simples e completo a um pedaço sofisticado com telas pela metade.

> **Consequência direta para este plano:** o tempo real e o Stripe são ampliações do fluxo
> mínimo. A ordem abaixo protege o núcleo primeiro.
>
> 0. Projeto Supabase criado + `DATABASE_URL`/`DIRECT_URL` funcionando com Prisma (§5.3.1) +
>    keep-alive do GitHub Actions (§5.3.3) -- meia hora que evita dois problemas caros
> 1. Auth própria (3 papéis, argon2, JWT) + schema Prisma + seed
> 2. Um catálogo (TMDb) → criar evento → mapa de assentos **sem** tempo real → pagamento fake →
>    ingresso com QR → portaria. **Ponta a ponta funcionando.**
> 3. Stripe test mode substituindo o pagamento fake
> 4. Supabase Realtime no mapa (RLS + `pg_cron`)
> 6. Compartilhamento por link, Google Sign-In, upload de imagem no Supabase Storage
> 7. Deploy (+1 ponto) -- agora viável inteiro na Vercel (§5.4)
> 8. Docker, se houver tempo
>
> Cada item de 3 em diante é opcional em relação ao item 2. Nada disso justifica entregar o
> fluxo principal incompleto.

### 12.1 Plano de corte -- o que morre primeiro se o tempo apertar

Sênior também é saber cortar. E cortar por escrito, antes de precisar, é mais convincente
do que sumir com uma feature sem explicar. Esta tabela vai no README -- não como desculpa,
como decisão de produto.

| Dia | Marco obrigatório | Se não chegar aqui, para tudo |
|---|---|---|
| 1 | Auth + schema + seed rodando | -- |
| 2 | Fluxo TMDb ponta a ponta (sem tempo real, pagamento fake) | -- |
| 3 | Stripe + validação de portaria completa | -- |
| 4 | Supabase Realtime no mapa | Se atrasar: mapa estático com polling de 5s, documentar |
| 5 | Supabase Realtime no mapa | Se atrasar: mapa estático com polling de 5s, documentar |
| 6 | Google Sign-In + Storage + compartilhamento | Se atrasar: remover Google Sign-In, manter e-mail/senha |
| 7 | Deploy + README final + CI verde | Não negociável -- banca avalia o que está no ar |

**Ordem de corte quando o tempo aperta (da menos para a mais dolorosa):**

1. **Google Sign-In** -- e-mail/senha já cobre autenticação. Remover não quebra nenhum
   requisito obrigatório. Uma linha no README: "login social omitido por tempo -- a
   arquitetura está preparada para adicionar (`GoogleAuthProvider` atrás da mesma interface)."

2. **Supabase Realtime** -- degradar para polling de 5s no snapshot da API. O mapa funciona,
   só não é ao vivo. Documentar a degradação e o caminho para o tempo real.

4. **Upload de imagem** -- usar URL do poster do TMDb diretamente, sem Storage próprio.
   Documentar como simplificação de escopo.

5. **Compartilhamento por link** -- gerar o link mas não implementar a página pública.
   O ingresso ainda tem o QR e funciona na portaria.

**O que nunca cortar:**
- Fluxo ponta a ponta (pelo menos com TMDb + assentos)
- Três papéis autenticados
- QR não forjável
- Anti-double-booking
- README completo
- CI verde

Registrar no README qual nível do plano foi entregue e quais itens foram cortados, com o
motivo. "Não tive tempo" não é motivo -- "priorizei X porque Y estava incompleto e o fluxo
inteiro vale mais que dois fluxos pela metade" é.

Vistos como diferenciais:
- Interface bem feita e agradável de usar
- Documentação clara
- Organização do código
- Tratamento de erros
- Boas práticas de versionamento
- Testes básicos

Mais do que as tecnologias em si, conta **como a solução é estruturada e como as decisões são explicadas**.
Iniciativa, criatividade e dedicação são bem avaliadas: se algo parecer que "ficaria melhor com tal
coisa", fazer e explicar o porquê no README.

---

## 13. Referências de fluxo (usar como ponto de partida, não copiar)

- **ingresso.com** -- mapa de assentos de cinema
- **sympla.com.br** -- criação de evento e checkout

---

## Anexo A -- Checklist de fechamento

**Fluxo**
- [ ] Catálogo TMDb → criação de sessão de filme → reserva de assento → pagamento
      (aprovado **e** recusado) → ingresso com QR → compartilhamento por link → validação na portaria
- [ ] Modo assento marcado (filme) funcionando
- [ ] Mapa reagindo em tempo real com duas abas abertas
- [ ] Fallback de polling verificado com o canal do Realtime derrubado (offline no DevTools)
- [ ] Revalidação do snapshot ao reconectar

**Integridade**
- [ ] Anti-double-booking testado sob concorrência (assento marcado)
- [ ] Anti-double-validation testado
- [ ] QR assinado / não forjável, armazenado em hash
- [ ] Hold expirando e devolvendo o assento ao estoque
- [ ] Nenhum `float` tocando valor monetário -- `grep -r "parseFloat" src/` deve voltar vazio em contexto de dinheiro
- [ ] `Order` e `Ticket` só transitam por estados válidos -- transição inválida lança erro antes de tocar o banco
- [ ] Webhook de `payment_intent.succeeded` entregue duas vezes não emite dois ingressos (idempotência testada)
- [ ] `Order` `PENDING` sem pagamento em 30 min é expirada pelo `pg_cron` e assento devolvido
- [ ] Datas armazenadas como `timestamptz` -- `TZ=UTC` no processo Node confirmado
- [ ] Portaria recusa ingresso fora da janela de tempo do evento (`GATE_TOO_EARLY` / `GATE_CLOSED`)

**Testes**
- [ ] `vitest run --project unit` passa sem banco -- zero conexão com Postgres
- [ ] `vitest run --project integration` passa com banco de teste limpo
- [ ] Teste de double-booking (assento): 20 concorrentes → exatamente 1 `fulfilled`, 19 `P2002`
- [ ] Teste de double-validation: 10 concorrentes → exatamente 1 atualização, 9 `rowCount = 0`
- [ ] Teste de QR: adulterado rejeitado, evento errado rejeitado, dois tickets geram códigos diferentes
- [ ] Teste de RBAC por endpoint: 401 sem token, 403 com papel errado, 400 com dados inválidos
- [ ] CI verde no GitHub Actions (badge no README)
- [ ] TMDb mockado com MSW -- CI não faz chamadas reais ao provedor externo

**Acessibilidade**
- [ ] Mapa de assentos tem `role="grid"` e células com `role="gridcell"`
- [ ] Navegação por setas entre células implementada (ArrowUp/Down/Left/Right)
- [ ] Estados do assento distinguíveis sem depender só de cor (ícone/forma como redundância)
- [ ] Live region (`aria-live="polite"`) anuncia mudanças do Realtime para leitores de tela
- [ ] Todos os botões CTA acessíveis por teclado (`tabIndex`, `onKeyDown` com Enter/Space)

**Escopo**
- [ ] README documenta qual nível do plano de corte foi entregue
- [ ] Itens cortados listados com motivo (não "falta de tempo" -- motivo de priorização)

**Segurança**
- [ ] Três papéis autenticados com permissões distintas + teste de 403 por rota sensível
- [ ] Senha em argon2/bcrypt, nunca em texto plano ou MD5
- [ ] Access token (15 min) + refresh token (7 dias) com rotação; refresh em cookie `httpOnly` + `Secure`
- [ ] Login com Google verificado no servidor com `google-auth-library` (`aud` e `iss` conferidos)
- [ ] Validação de e-mail com domínio composto (`.com.br`) aceita; normalizado com `trim` + `toLowerCase`
- [ ] Helmet, CORS com allowlist explícita, rate limit agressivo em login/refresh, Zod em toda borda
- [ ] Ownership checado no banco (sem IDOR) -- organizador só edita evento próprio
- [ ] **RLS habilitado em todas as tabelas; `anon key` testada contra `User` e `Ticket` → 0 linhas**
- [ ] **`service_role key` ausente do bundle do front** -- `grep -r "service_role" dist/` vazio
- [ ] `pg_cron` não usa `service_role` exposta -- roda internamente no banco
- [ ] Nenhum segredo no histórico do Git -- verificar com `git log -S "sk_" --all`

**API**
- [ ] Todos os endpoints respondem sob `/api/v1/` -- nenhuma rota sem prefixo de versão
- [ ] `GET /health` responde sem autenticação e sem revelar versões internas
- [ ] Respostas de listagem seguem `{ data, meta }` -- nenhum array nu na raiz
- [ ] `page` e `limit` validados com Zod antes de chegar ao controller (coerce + min/max)
- [ ] `findMany` e `count` executados em paralelo com `Promise.all` -- nunca sequencial
- [ ] `total` vem do banco (`count`), não de `data.length`
- [ ] `limit` máximo de 100 aplicado no schema -- sem listagem ilimitada

**Logging**
- [ ] `console.log` não aparece em nenhum arquivo de `src/` -- `grep -r "console\.log" src/` vazio
- [ ] Toda requisição tem `requestId` único no header `x-request-id` da resposta
- [ ] Log de erro 500 inclui `requestId` no corpo -- usuário pode copiar e reportar
- [ ] Campos sensíveis (`authorization`, `cookie`, `password`, `passwordHash`) não aparecem em log
- [ ] `LOG_LEVEL=warn` nos testes -- CI não polui output com logs de info
- [ ] Webhook do Stripe logado com `stripeEventId` -- rastreável sem busca manual

**Arquitetura**
- [ ] `process.env` não aparece fora de `config/env.ts` -- `grep -r "process\.env" src/` (exceto o próprio arquivo)
- [ ] Controller sem import de Prisma -- `grep -rn "@prisma/client" src/modules/*/.*controller*` vazio
- [ ] Service sem import de Express (`Request`, `Response`) -- grep confirma separação de camadas
- [ ] Erro de negócio nunca chega ao front com stack trace em produção (`NODE_ENV=production` testado)
- [ ] `AppError` cobre todos os casos de erro de negócio -- nenhum `throw new Error('string solta')` no Service

**Operação**
- [ ] Seeds executando com um comando
- [ ] `.env.example` completo e correto
- [ ] Webhook do Stripe idempotente e com assinatura validada
- [ ] Cartões de teste visíveis na tela de pagamento
- [ ] `pg_cron` agendado e expirando holds de fato
- [ ] **Keep-alive do Supabase rodando** (GitHub Actions) -- o projeto não pode pausar antes da
      correção da banca
- [ ] Migrations aplicadas no Supabase a partir de um banco limpo, do zero, sem `migrate reset`

**Entrega**
- [ ] README: setup, banco de dados, variáveis de ambiente, como rodar, credenciais de teste,
      limitações conhecidas, decisões de projeto, uso de IA
- [ ] ADRs / registro de decisões versionado
- [ ] Deploy publicado (+1 ponto)

---

## Anexo B -- Decisões em aberto

| # | Questão | Status |
|---|---|---|
| ~~1~~ | ~~Host do Postgres~~ | ✅ **Supabase** (rev. 3) |
| ~~2~~ | ~~Storage de imagem~~ | ✅ **Supabase Storage**, bucket público (rev. 3) |
| ~~4~~ | ~~Deploy do back-end fora da Vercel por causa do Socket.IO~~ | ✅ API stateless, Vercel serve os dois (rev. 3) |
| ~~7~~ | ~~Dev contra Postgres local ou direto no Supabase~~ | ✅ **local via Docker** recomendado em §5.3.2 (rev. 3) |
| 3 | Recusa de pagamento: libera o assento imediatamente ou mantém o hold pelo TTL restante para nova tentativa | ao integrar o Stripe -- registrar no README |
| 5 | Docker Compose para desenvolvimento | após o fluxo ponta a ponta rodar -- §5.4 |
| 6 | Sincronia da `seat_state`: trigger no Postgres ou escrita dupla na transação do Prisma | ao implementar §4.4 -- registrar escolha no README |
| ~~TM~~ | ~~Ticketmaster + setores por quantidade~~ | ✅ fora do escopo -- TMDb apenas (rev. 10) |
| 8 | Nível do plano de corte (§12.1) efetivamente entregue | atualizar no README no último dia |