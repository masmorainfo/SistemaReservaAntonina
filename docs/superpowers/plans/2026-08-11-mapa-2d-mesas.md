# Mapa 2D de Mesas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a caixa de mapa sempre-vazia de `/reservar-mesa` por um mapa 2D esquemático real, com o inventário completo de mesas do Deck e do Salão Principal (levantado com o dono a partir do tour Matterport) posicionado corretamente.

**Architecture:** Reaproveita 100% a arquitetura de coordenadas já existente (`Mesa.posicaoTour`, `TableMapProvider`/`FallbackMapProvider`, `loadZonesFromDb`) — nenhuma mudança de schema Prisma. O trabalho é: (1) popular `posicaoTour` real via `prisma/seed.ts` para as 28 mesas reais (12 Salão + 16 Deck, incluindo os registros duplicados por dia do Deck), substituindo os 3 placeholders de teste; (2) duas imagens SVG estáticas de fundo (uma por ambiente), só contexto/ambientação — sem desenhar caixas de mesa fixas nelas, porque o Deck muda de layout por dia da semana e um desenho estático nunca bateria com as duas configurações ao mesmo tempo; (3) o `ReservaMesaWizard` aplica a imagem de fundo certa via CSS `background-image`, calculado a partir do nome do ambiente selecionado.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, CSS Modules, Vitest + React Testing Library, SVG estático servido de `public/`.

## Global Constraints

- Nenhuma mudança de schema Prisma — `posicaoTour` (`String?`) e o índice não-único em `[ambienteId, numero]` já existem.
- `Mesa.diasSemanaAtivos` usa a convenção `Date.getDay()`: `0`=domingo … `6`=sábado (já usada em todo o código).
- `Mesa.numero` é sempre o número puro (`"11"`, `"03"`), sem prefixo "Mesa " — a UI já prefixa "Mesa " na renderização.
- Coordenadas de `posicaoTour` são `{ x, y, largura, altura }` em porcentagem (0–100) do container `.mapa`, que tem `aspect-ratio: 16/9` — os dois SVGs novos usam `viewBox="0 0 1600 900"` (mesma proporção 16:9) especificamente para que uma posição em pixels no SVG corresponda 1:1 (dividindo por 16 e 9) à mesma porcentagem usada no `posicaoTour`, sem precisar de conversão mental.
- Mezanino fica fora deste levantamento (excluído da reserva diária de mesa via `AMBIENTE_EXCLUIDO_DA_RESERVA_DIARIA`); sua mesa placeholder (`M01`) não é tocada.
- O placeholder antigo `D01` do Deck não corresponde a nenhuma mesa real e deve ser removido do seed.
- `prisma/seed.ts` deve continuar idempotente: rodar de novo sempre converge pro estado correto, inclusive corrigindo `capacidadeLugares`/`posicaoTour` de mesas que já existem de uma rodada anterior (isso é uma mudança de comportamento da correção assumida hoje, mas correta aqui: não existe UI de admin pra customizar essas mesas, então não há "customização do dono" pra proteger).

---

## Inventário completo (referência única de dados — não repetir noutro lugar)

### Salão Principal — 12 mesas, sem variação por dia (`diasSemanaAtivos` padrão, todos os dias)

| numero | capacidadeLugares | zona | x | y | largura | altura |
|---|---|---|---|---|---|---|
| 01 | 4 | adega | 4.69 | 48.33 | 5.63 | 10 |
| 02 | 4 | adega | 4.69 | 33.89 | 5.63 | 10 |
| 03 | 6 | quadros | 34.38 | 12.22 | 8.75 | 8.89 |
| 04 | 6 | quadros | 45.63 | 12.22 | 8.75 | 8.89 |
| 05 | 6 | quadros | 56.88 | 12.22 | 8.75 | 8.89 |
| 10 | 12 | entre pilastras | 41.88 | 42.22 | 16.25 | 13.33 |
| 07 | 2 | bar (fileira 1, esq.) | 80 | 24.44 | 5.63 | 10 |
| 06 | 2 | bar (fileira 1, dir.) | 88.75 | 24.44 | 5.63 | 10 |
| 18 | 2 | bar (fileira 2, esq.) | 80 | 42.22 | 5.63 | 10 |
| 08 | 2 | bar (fileira 2, dir.) | 88.75 | 42.22 | 5.63 | 10 |
| 19 | 2 | bar (fileira 3, esq.) | 80 | 60 | 5.63 | 10 |
| 09 | 2 | bar (fileira 3, dir.) | 88.75 | 60 | 5.63 | 10 |

### Deck — 16 registros de Mesa (algumas números aparecem em mais de um registro, dias mutuamente exclusivos)

Lado esquerdo, terça+quarta+quinta+domingo (`diasSemanaAtivos: [0, 2, 3, 4]`), 4 lugares:

| numero | x | y | largura | altura |
|---|---|---|---|---|
| 11 | 9.38 | 33.33 | 9.38 | 16.67 |
| 15 | 21.88 | 33.33 | 9.38 | 16.67 |
| 12 | 9.38 | 55.56 | 9.38 | 16.67 |
| 14 | 21.88 | 55.56 | 9.38 | 16.67 |

Lado esquerdo, sexta+sábado (`diasSemanaAtivos: [5, 6]`), 2 lugares:

| numero | x | y | largura | altura |
|---|---|---|---|---|
| 11 | 8.75 | 32.22 | 6.88 | 15.56 |
| 12 | 16.88 | 32.22 | 6.88 | 15.56 |
| 16 | 25 | 32.22 | 6.88 | 15.56 |
| 14 | 8.75 | 50 | 6.88 | 15.56 |
| 15 | 16.88 | 50 | 6.88 | 15.56 |
| 17 | 25 | 50 | 6.88 | 15.56 |

Lado direito, terça+quarta+quinta+domingo (`diasSemanaAtivos: [0, 2, 3, 4]`), 4 lugares:

| numero | x | y | largura | altura |
|---|---|---|---|---|
| 16 | 68.75 | 33.33 | 9.38 | 16.67 |
| 17 | 68.75 | 55.56 | 9.38 | 16.67 |

Lado direito, todos os dias (`diasSemanaAtivos` padrão), 4 lugares:

| numero | x | y | largura | altura |
|---|---|---|---|---|
| 21 | 81.25 | 33.33 | 9.38 | 16.67 |
| 20 | 81.25 | 55.56 | 9.38 | 16.67 |

Lado direito, sexta+sábado (`diasSemanaAtivos: [5, 6]`), 4 lugares — **suposição documentada no spec**: 16→22, 17→23 por ordem (dono ainda não confirmou qual vira qual, cosmético):

| numero | x | y | largura | altura |
|---|---|---|---|---|
| 22 | 68.75 | 33.33 | 9.38 | 16.67 |
| 23 | 68.75 | 55.56 | 9.38 | 16.67 |

---

## File Structure

New files:
- `public/images/mapa-deck.svg` — fundo esquemático do Deck (contexto/ambientação, sem caixas de mesa).
- `public/images/mapa-salao-principal.svg` — fundo esquemático do Salão Principal.

Modified files:
- `prisma/seed.ts` — helper `criarMesaSeNaoExistir` vira `upsertMesa` (converge capacidade/posição em cada rodada, não só cria); todo o inventário real do Deck e Salão Principal; remove o placeholder `D01`.
- `prisma/schema.prisma` — só o comentário acima de `diasSemanaAtivos` (linhas 59-61), atualizado com os números reais em vez do exemplo antigo. Nenhuma mudança de coluna/migração.
- `src/app/reservar-mesa/ReservaMesaWizard.tsx` — aplica `background-image` no `.mapa` conforme o ambiente selecionado.
- `src/app/reservar-mesa/ReservaMesaWizard.module.css` — `.mapa` ganha `background-size`/`background-position`/`background-repeat`.
- `src/app/reservar-mesa/ReservaMesaWizard.test.tsx` — novo teste cobrindo a troca de imagem de fundo por ambiente.

---

### Task 1: Inventário real no seed (Deck + Salão Principal)

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `prisma/schema.prisma:59-61` (comentário apenas)

**Interfaces:**
- Produces: `upsertMesa(params: { ambienteId: string; numero: string; capacidadeLugares: number; diasSemanaAtivos?: number[]; posicaoTour?: string }): Promise<void>` — substitui `criarMesaSeNaoExistir`. Sem consumidores fora deste arquivo.

- [ ] **Step 1: Atualizar o comentário do schema (documentação, sem migração)**

Em `prisma/schema.prisma`, substituir:

```prisma
  // Dias da semana em que este registro de Mesa está ativo (0=domingo .. 6=sábado).
  // Usado pelas mesas duplas do Deck (11, 12, 21): um conjunto de registros para
  // domingo-quinta e outro para sexta/sábado, nunca ativos ao mesmo tempo.
  diasSemanaAtivos  Int[]         @default([0, 1, 2, 3, 4, 5, 6])
```

com:

```prisma
  // Dias da semana em que este registro de Mesa está ativo (0=domingo .. 6=sábado).
  // Usado pelas mesas do Deck que mudam de configuração por dia: o mesmo número
  // pode ter mais de um registro (ex.: mesa "11" é 4 lugares terça-quinta+domingo
  // e 2 lugares sexta/sábado), cada um ativo em dias mutuamente exclusivos. Ver
  // docs/superpowers/specs/2026-08-11-mapa-2d-mesas-design.md pro inventário completo.
  diasSemanaAtivos  Int[]         @default([0, 1, 2, 3, 4, 5, 6])
```

- [ ] **Step 2: Substituir o helper de criação de mesa por um upsert real**

Em `prisma/seed.ts`, substituir o bloco:

```ts
// Mesa não tem mais @@unique([ambienteId, numero]) (virou @@index, ver
// prisma/schema.prisma) porque as mesas duplas do Deck podem ter o mesmo
// número em dois registros distintos (padrão vs. sexta/sábado). Por isso o
// seed não pode mais usar prisma.mesa.upsert com a chave composta gerada
// (ambienteId_numero) — ela deixou de existir. Criamos apenas se não houver
// nenhuma Mesa com esse ambienteId+numero ainda.
async function criarMesaSeNaoExistir(params: {
  ambienteId: string;
  numero: string;
  capacidadeLugares: number;
}): Promise<void> {
  const existente = await prisma.mesa.findFirst({
    where: { ambienteId: params.ambienteId, numero: params.numero },
  });

  if (!existente) {
    await prisma.mesa.create({ data: params });
  }
}
```

com:

```ts
// Mesa não tem @@unique([ambienteId, numero]) (é @@index, ver prisma/schema.prisma)
// porque mesas do Deck podem ter o mesmo número em mais de um registro — um por
// configuração de dia da semana (ex.: mesa "11" tem um registro pra terça-quinta+
// domingo e outro, com capacidade diferente, pra sexta/sábado). O identificador
// real de "mesma mesa" pro seed é (ambienteId, numero, diasSemanaAtivos) juntos.
//
// Sempre atualiza capacidade/posição mesmo se já existir — diferente da política
// de "só semeia se vazio" usada pra política de cancelamento, aqui não existe UI
// de admin pra customizar mesa, então não há nada de admin pra proteger; o seed é
// a fonte da verdade e deve convergir pro inventário real a cada rodada.
async function upsertMesa(params: {
  ambienteId: string;
  numero: string;
  capacidadeLugares: number;
  diasSemanaAtivos?: number[];
  posicaoTour?: string;
}): Promise<void> {
  const diasSemanaAtivos = params.diasSemanaAtivos ?? [0, 1, 2, 3, 4, 5, 6];
  const existente = await prisma.mesa.findFirst({
    where: {
      ambienteId: params.ambienteId,
      numero: params.numero,
      diasSemanaAtivos: { equals: diasSemanaAtivos },
    },
  });

  if (existente) {
    await prisma.mesa.update({
      where: { id: existente.id },
      data: {
        capacidadeLugares: params.capacidadeLugares,
        posicaoTour: params.posicaoTour ?? null,
      },
    });
  } else {
    await prisma.mesa.create({
      data: {
        ambienteId: params.ambienteId,
        numero: params.numero,
        capacidadeLugares: params.capacidadeLugares,
        diasSemanaAtivos,
        posicaoTour: params.posicaoTour ?? null,
      },
    });
  }
}

function coordenadas(x: number, y: number, largura: number, altura: number): string {
  return JSON.stringify({ x, y, largura, altura });
}
```

- [ ] **Step 3: Substituir toda a criação de mesas do Deck e Salão Principal**

No mesmo arquivo, substituir o bloco (que hoje cria só `D01`, `03` e `M01`):

```ts
  await criarMesaSeNaoExistir({ ambienteId: deck.id, numero: "D01", capacidadeLugares: 4 });

  await criarMesaSeNaoExistir({
    ambienteId: salaoPrincipal.id,
    numero: "03",
    capacidadeLugares: 6,
  });

  await criarMesaSeNaoExistir({
    ambienteId: mezanino.id,
    numero: "M01",
    capacidadeLugares: 12,
  });
```

com:

```ts
  // Placeholder de teste antigo, não corresponde a nenhuma mesa real do Deck.
  await prisma.mesa.deleteMany({ where: { ambienteId: deck.id, numero: "D01" } });

  // Salão Principal — 12 mesas, sem variação por dia da semana.
  // Inventário completo em docs/superpowers/specs/2026-08-11-mapa-2d-mesas-design.md
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "01",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(4.69, 48.33, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "02",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(4.69, 33.89, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "03",
    capacidadeLugares: 6,
    posicaoTour: coordenadas(34.38, 12.22, 8.75, 8.89),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "04",
    capacidadeLugares: 6,
    posicaoTour: coordenadas(45.63, 12.22, 8.75, 8.89),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "05",
    capacidadeLugares: 6,
    posicaoTour: coordenadas(56.88, 12.22, 8.75, 8.89),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "10",
    capacidadeLugares: 12,
    posicaoTour: coordenadas(41.88, 42.22, 16.25, 13.33),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "07",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(80, 24.44, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "06",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(88.75, 24.44, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "18",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(80, 42.22, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "08",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(88.75, 42.22, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "19",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(80, 60, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "09",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(88.75, 60, 5.63, 10),
  });

  // Deck — lado esquerdo, terça+quarta+quinta+domingo: 4 mesas de 4 lugares.
  const DIAS_TER_QUA_QUI_DOM = [0, 2, 3, 4];
  const DIAS_SEX_SAB = [5, 6];

  await upsertMesa({
    ambienteId: deck.id,
    numero: "11",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(9.38, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "15",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(21.88, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "12",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(9.38, 55.56, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "14",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(21.88, 55.56, 9.38, 16.67),
  });

  // Deck — lado esquerdo, sexta+sábado: as mesmas 4 mesas se dividem em 6 de 2 lugares.
  await upsertMesa({
    ambienteId: deck.id,
    numero: "11",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(8.75, 32.22, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "12",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(16.88, 32.22, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "16",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(25, 32.22, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "14",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(8.75, 50, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "15",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(16.88, 50, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "17",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(25, 50, 6.88, 15.56),
  });

  // Deck — lado direito, terça+quarta+quinta+domingo: 16 e 17 são exclusivas desses dias.
  await upsertMesa({
    ambienteId: deck.id,
    numero: "16",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(68.75, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "17",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(68.75, 55.56, 9.38, 16.67),
  });

  // Deck — lado direito, 20 e 21 não mudam: mesmo lugar, mesma capacidade, todos os dias.
  await upsertMesa({
    ambienteId: deck.id,
    numero: "21",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(81.25, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "20",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(81.25, 55.56, 9.38, 16.67),
  });

  // Deck — lado direito, sexta+sábado: 22 e 23 ocupam o lugar que 16/17 tinham
  // nos outros dias (suposição documentada no spec — dono ainda não confirmou
  // se é 16->22/17->23 ou o inverso; cosmético, não afeta a lógica de reserva).
  await upsertMesa({
    ambienteId: deck.id,
    numero: "22",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(68.75, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "23",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(68.75, 55.56, 9.38, 16.67),
  });

  await upsertMesa({
    ambienteId: mezanino.id,
    numero: "M01",
    capacidadeLugares: 12,
  });
```

- [ ] **Step 4: Rodar o seed localmente e verificar**

Run: `npm run db:seed`
Expected: termina com `Seed concluído.`, sem erros.

Run (verificação manual, node REPL ou script rápido):
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const total = await prisma.mesa.count();
  const deckSemD01 = await prisma.mesa.findFirst({ where: { numero: 'D01' } });
  console.log('total de mesas:', total);
  console.log('D01 ainda existe?', deckSemD01 !== null);
  await prisma.\$disconnect();
})();
"
```
Expected: `total de mesas: 28` (contando também `M01` do Mezanino, que não é tocado — confirma 12 Salão + 16 Deck + 1 Mezanino... espera, isso dá 29, não 28. Reconferir: o count total inclui M01 que já existia antes; o que importa aqui é que o total NÃO inclua mais `D01` e que existam exatamente 12 mesas com `ambienteId` do Salão Principal e 16 com `ambienteId` do Deck. `D01 ainda existe?` deve imprimir `false`.

- [ ] **Step 5: Rodar o seed de novo pra confirmar idempotência**

Run: `npm run db:seed`
Expected: termina com `Seed concluído.` de novo, sem criar duplicatas (o total de mesas do passo anterior deve continuar igual).

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts prisma/schema.prisma
git commit -m "feat: popula inventário real de mesas do Deck e Salão Principal"
```

---

### Task 2: Imagens de fundo do mapa (SVG esquemático)

**Files:**
- Create: `public/images/mapa-salao-principal.svg`
- Create: `public/images/mapa-deck.svg`

**Interfaces:**
- Produces: dois arquivos estáticos servidos em `/images/mapa-salao-principal.svg` e `/images/mapa-deck.svg` (convenção do Next.js: tudo em `public/` é servido a partir de `/`). Consumidos pela Task 3 via `background-image`.

Ambos são só contexto/ambientação — paredes, rótulos de zona, pilastras, plantas — **sem** desenhar caixas de mesa fixas: as mesas de verdade são os botões renderizados pelo React (`.mesaNoMapa`), posicionados via `posicaoTour`. Isso evita qualquer risco de desalinhamento entre o desenho estático e as posições dinâmicas — crítico pro Deck, que muda de layout por dia da semana.

- [ ] **Step 1: Criar o SVG do Salão Principal**

Create `public/images/mapa-salao-principal.svg`:

```svg
<svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" font-family="Georgia, serif">
  <rect x="0" y="0" width="1600" height="900" fill="#f6f1e7"/>
  <rect x="20" y="20" width="1560" height="860" fill="none" stroke="#5c3a3f" stroke-width="4"/>

  <text x="50" y="65" font-size="34" fill="#5c3a3f" font-weight="bold">SALÃO PRINCIPAL</text>

  <!-- Adega -->
  <rect x="40" y="280" width="280" height="280" fill="none" stroke="#8a5a3f" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="55" y="305" font-size="20" fill="#8a5a3f">adega</text>
  <text x="30" y="450" font-size="16" fill="#8a5a3f" transform="rotate(-90 30 450)">porta cozinha</text>
  <g stroke="#8a5a3f" stroke-width="2">
    <line x1="60" y1="300" x2="60" y2="540"/>
    <line x1="75" y1="300" x2="75" y2="540"/>
    <line x1="90" y1="300" x2="90" y2="540"/>
  </g>

  <!-- Quadros -->
  <text x="800" y="70" font-size="18" fill="#8a5a3f" text-anchor="middle">quadros ↑</text>
  <g fill="none" stroke="#c9a84c" stroke-width="3">
    <rect x="560" y="95" width="50" height="65"/>
    <rect x="775" y="95" width="50" height="65"/>
    <rect x="990" y="95" width="50" height="65"/>
  </g>

  <!-- Pilastras -->
  <rect x="680" y="200" width="24" height="480" fill="#8a5a3f"/>
  <rect x="920" y="200" width="24" height="480" fill="#8a5a3f"/>
  <text x="692" y="195" font-size="14" fill="#8a5a3f" text-anchor="middle">pilastra</text>
  <text x="932" y="195" font-size="14" fill="#8a5a3f" text-anchor="middle">pilastra</text>

  <!-- Bar -->
  <rect x="1250" y="180" width="300" height="560" fill="none" stroke="#8a5a3f" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="1400" y="160" font-size="26" fill="#5c3a3f" font-weight="bold" text-anchor="middle">BAR</text>
  <text x="1400" y="765" font-size="15" fill="#8a5a3f" text-anchor="middle">entrada por porta de vidro corrediça</text>

  <!-- Entrada do salão -->
  <rect x="720" y="810" width="160" height="14" fill="#c9a84c"/>
  <text x="800" y="855" font-size="18" fill="#5c3a3f" text-anchor="middle">entrada</text>
</svg>
```

- [ ] **Step 2: Criar o SVG do Deck**

Create `public/images/mapa-deck.svg`:

```svg
<svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" font-family="Georgia, serif">
  <rect x="0" y="0" width="1600" height="900" fill="#efe0c9"/>
  <rect x="20" y="20" width="1560" height="860" fill="none" stroke="#5c3a3f" stroke-width="4"/>

  <text x="50" y="65" font-size="34" fill="#5c3a3f" font-weight="bold">DECK</text>

  <!-- Piso de madeira (linhas decorativas) -->
  <g stroke="#d9c4a0" stroke-width="2" opacity="0.6">
    <line x1="20" y1="150" x2="1580" y2="150"/>
    <line x1="20" y1="250" x2="1580" y2="250"/>
    <line x1="20" y1="350" x2="1580" y2="350"/>
    <line x1="20" y1="450" x2="1580" y2="450"/>
    <line x1="20" y1="550" x2="1580" y2="550"/>
    <line x1="20" y1="650" x2="1580" y2="650"/>
    <line x1="20" y1="750" x2="1580" y2="750"/>
  </g>

  <text x="290" y="270" font-size="18" fill="#8a5a3f" text-anchor="middle">lado esquerdo</text>
  <text x="1310" y="270" font-size="18" fill="#8a5a3f" text-anchor="middle">lado direito</text>

  <!-- Plantas decorativas nos cantos -->
  <g fill="#6b8a5a" opacity="0.7">
    <circle cx="70" cy="750" r="26"/>
    <circle cx="100" cy="770" r="20"/>
    <circle cx="1530" cy="750" r="26"/>
    <circle cx="1500" cy="770" r="20"/>
  </g>

  <!-- Corredor / entrada central -->
  <rect x="700" y="300" width="200" height="480" fill="none" stroke="#8a5a3f" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="800" y="470" font-size="18" fill="#8a5a3f" text-anchor="middle">portão / rua</text>
  <rect x="760" y="740" width="80" height="14" fill="#c9a84c"/>
  <text x="800" y="785" font-size="18" fill="#5c3a3f" text-anchor="middle">entrada</text>
</svg>
```

- [ ] **Step 3: Verificar visualmente**

Run: `npm run dev` (se não estiver rodando) e abrir `http://localhost:3000/images/mapa-deck.svg` e `http://localhost:3000/images/mapa-salao-principal.svg` diretamente no navegador.
Expected: os dois SVGs renderizam sem erro, com os rótulos de zona legíveis.

- [ ] **Step 4: Commit**

```bash
git add public/images/mapa-deck.svg public/images/mapa-salao-principal.svg
git commit -m "feat: adiciona plantas esquemáticas do Deck e Salão Principal"
```

---

### Task 3: Aplicar a imagem de fundo no mapa do wizard

**Files:**
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.tsx`
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.module.css`
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.test.tsx`

**Interfaces:**
- Consumes: `/images/mapa-deck.svg`, `/images/mapa-salao-principal.svg` (Task 2).
- Produces: nenhuma interface nova exportada — mudança interna de renderização.

- [ ] **Step 1: Escrever o teste que falha primeiro**

Em `src/app/reservar-mesa/ReservaMesaWizard.test.tsx`, adicionar este teste dentro do primeiro `describe("ReservaMesaWizard", ...)`, logo antes do `});` de fechamento:

```tsx

  it("aplica a imagem de fundo do mapa conforme o ambiente selecionado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/horarios-disponiveis")) {
          return new Response(JSON.stringify({ horarios: ["18:30"] }), { status: 200 });
        }
        if (url.toString().includes("/api/mesas-disponiveis")) {
          return new Response(JSON.stringify({ mesas: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );

    render(
      <ReservaMesaWizard
        ambientes={[
          { id: "amb_deck", nome: "Deck" },
          { id: "amb_salao", nome: "Salão Principal" },
        ]}
        zonasPorAmbiente={{ amb_deck: [], amb_salao: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-11" } });
    fireEvent.click(screen.getByText("Ver horários"));
    await waitFor(() => {
      expect(screen.getByText("18:30")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByText("Escolher mesa"));

    const mapaDeck = await screen.findByLabelText("Mapa do ambiente Deck");
    expect(mapaDeck.style.backgroundImage).toBe("url(/images/mapa-deck.svg)");

    fireEvent.click(screen.getByRole("button", { name: "Salão Principal" }));

    await waitFor(() => {
      const mapaSalao = screen.getByLabelText("Mapa do ambiente Salão Principal");
      expect(mapaSalao.style.backgroundImage).toBe("url(/images/mapa-salao-principal.svg)");
    });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/app/reservar-mesa/ReservaMesaWizard.test.tsx`
Expected: FAIL — `mapaDeck.style.backgroundImage` está vazio hoje (o `.mapa` não tem `style` nenhum).

- [ ] **Step 3: Adicionar o mapeamento ambiente → imagem no componente**

Em `src/app/reservar-mesa/ReservaMesaWizard.tsx`, adicionar logo depois de `PASSOS`:

```tsx
const IMAGEM_MAPA_POR_AMBIENTE: Record<string, string> = {
  Deck: "/images/mapa-deck.svg",
  "Salão Principal": "/images/mapa-salao-principal.svg",
};
```

Depois, dentro do componente, logo após as declarações de `useState` (antes de `async function buscarHorarios`), adicionar:

```tsx
  const ambienteSelecionado = ambientes.find((a) => a.id === ambienteSelecionadoId);
  const imagemMapa = ambienteSelecionado
    ? IMAGEM_MAPA_POR_AMBIENTE[ambienteSelecionado.nome]
    : undefined;
```

- [ ] **Step 4: Usar as novas variáveis no JSX do mapa**

Substituir:

```tsx
          <div
            aria-label={`Mapa do ambiente ${ambientes.find((a) => a.id === ambienteSelecionadoId)?.nome ?? ""}`}
            className={styles.mapa}
          >
```

com:

```tsx
          <div
            aria-label={`Mapa do ambiente ${ambienteSelecionado?.nome ?? ""}`}
            className={styles.mapa}
            style={imagemMapa ? { backgroundImage: `url(${imagemMapa})` } : undefined}
          >
```

- [ ] **Step 5: Ajustar o CSS do `.mapa` pra imagem de fundo se comportar bem**

Em `src/app/reservar-mesa/ReservaMesaWizard.module.css`, substituir:

```css
.mapa {
  position: relative;
  margin-bottom: var(--space-md);
  border: 1px solid var(--paper-border);
  aspect-ratio: 16 / 9;
}
```

com:

```css
.mapa {
  position: relative;
  margin-bottom: var(--space-md);
  border: 1px solid var(--paper-border);
  aspect-ratio: 16 / 9;
  background-color: var(--paper);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
```

- [ ] **Step 6: Rodar o teste de novo e confirmar que passa**

Run: `npx vitest run src/app/reservar-mesa/ReservaMesaWizard.test.tsx`
Expected: PASS (4 testes no total agora).

- [ ] **Step 7: Rodar a suíte inteira e o typecheck**

Run: `npm test`
Expected: todos os arquivos passam.

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/reservar-mesa/ReservaMesaWizard.tsx src/app/reservar-mesa/ReservaMesaWizard.module.css src/app/reservar-mesa/ReservaMesaWizard.test.tsx
git commit -m "feat: mostra a planta esquemática de fundo no mapa de reserva de mesa"
```

---

### Task 4: Verificação final e atualização do banco de produção

**Files:** nenhum (verificação + operação de dados, não código).

- [ ] **Step 1: Suíte completa local**

Run: `npm test`
Expected: todos os arquivos passam (re-rodar uma vez se parecer truncado — segfault intermitente conhecido neste ambiente Windows).

Run: `npm run typecheck`
Expected: sem erros.

Run: `npm run build`
Expected: build de produção passa sem erros (confirma que os SVGs em `public/images/` são servidos corretamente e não quebram nada).

- [ ] **Step 2: Checagem visual manual local**

Com `npm run dev` rodando, abrir `/reservar-mesa`, preencher uma data de terça-feira, avançar até "Onde", e conferir:
- O mapa do Deck mostra o fundo esquemático com 4 botões de mesa posicionados nos dois grupos (esquerda: 11,15,12,14; direita: 16,21,17,20), todos com 4 lugares.
- Trocar pra uma data de sexta-feira e repetir: lado esquerdo agora mostra 6 botões (11,12,16,14,15,17) de 2 lugares; lado direito mostra 20,21 nas mesmas posições de sempre e 22,23 nas posições onde antes apareciam 16,17.
- Trocar de ambiente pra "Salão Principal": mapa mostra o fundo esquemático certo, com as 12 mesas posicionadas nas zonas corretas (adega, quadros, entre pilastras, bar).
- Nenhuma mesa exibida na tela sem estar na "Lista de mesas" abaixo do mapa (mapa e lista sempre em sincronia, já garantido pelo código existente).

- [ ] **Step 3: Atualizar o banco de produção (Railway)**

Este passo modifica dados reais em produção — confirmar com o usuário antes de rodar, mesmo já tendo feito esse tipo de operação antes nesta sessão (criar proxy TCP temporário no Postgres do projeto `antonina-osteria`, rodar `npm run db:seed` local apontando pra ele via `DATABASE_URL`, remover o proxy depois). Mesmo procedimento já usado pra rodar o seed inicial em produção.

Run (com `SEED_ADMIN_SENHA` e `DATABASE_URL` do proxy temporário — ver histórico desta sessão pra credenciais):
```bash
railway tcp-proxy create --port 5432 --service Postgres --json
# DATABASE_URL="postgresql://postgres:<senha>@<host-do-proxy>:<porta>/railway" SEED_ADMIN_SENHA="<senha>" npm run db:seed
railway tcp-proxy delete <id-do-proxy> --service Postgres --yes
```

Expected: `Seed concluído.`, proxy removido depois.

- [ ] **Step 4: Confirmar em produção**

Abrir `https://web-production-7591ca.up.railway.app/reservar-mesa` (ou o domínio atual do serviço), repetir a checagem visual do Passo 2 contra o ambiente real.

---

## Self-Review

**Spec coverage:**
- Inventário do Salão Principal (12 mesas, 4 zonas) → Task 1. ✅
- Inventário do Deck (16 registros, permutação confirmada, suposição 16→22/17→23 documentada) → Task 1. ✅
- Placa esquemática (decisão de não usar foto, sem caixas de mesa fixas por causa do Deck variável) → Task 2. ✅
- Wiring da imagem de fundo por ambiente → Task 3. ✅
- Critério de aceitação "nenhuma mudança de schema" → confirmado, Task 1 só migra dado + comentário. ✅
- Critério de aceitação "mapa do Deck troca automaticamente por dia" → já garantido pelo filtro existente em `mesasDisponiveis`/`zonasPorAmbiente` no `ReservaMesaWizard`, sem lógica nova — coberto pela checagem manual da Task 4. ✅

**Placeholder scan:** sem TBD/TODO; todo código e coordenadas são valores reais e completos.

**Type consistency:** `upsertMesa` usado com a mesma assinatura em todas as chamadas da Task 1; `IMAGEM_MAPA_POR_AMBIENTE`/`imagemMapa` só usados dentro de `ReservaMesaWizard.tsx` (Task 3), nomes de ambiente (`"Deck"`, `"Salão Principal"`) batendo exatamente com o que `prisma/seed.ts` cria via `prisma.ambiente.upsert({ where: { nome: "Deck" } })` / `{ nome: "Salão Principal" }` — sem risco de nome divergente entre o seed e o lookup do componente.

**Correção de contagem:** o spec de design tinha "11 mesas"/"27 registros" por um erro de soma (2+3+1+6=12, não 11) — já corrigido no próprio spec (`docs/superpowers/specs/2026-08-11-mapa-2d-mesas-design.md`) pra 12 mesas no Salão / 28 registros no total, batendo com este plano.
