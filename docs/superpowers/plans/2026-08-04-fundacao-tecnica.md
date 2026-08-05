# Fundação Técnica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a base técnica compartilhada (projeto Next.js, Docker local, banco de dados, regras de negócio puras, adaptadores plugáveis e autenticação com perfis) sobre a qual os próximos planos (Reserva de Mesa Diária, Reserva de Evento, Painel Admin) serão construídos.

**Architecture:** Next.js (App Router, TypeScript) + PostgreSQL via Prisma ORM, rodando localmente em Docker Desktop (docker-compose) e hospedado no Railway em produção. Regras de negócio isoladas em funções puras testáveis. Pagamento, notificação e seleção de mesa 3D ficam atrás de interfaces (`PaymentProvider`, `NotificationProvider`, `TableMapProvider`) com implementações mock/fallback nesta fase.

**Tech Stack:** Next.js 14 (App Router) · TypeScript (strict) · PostgreSQL 16 · Prisma ORM · Auth.js (NextAuth v5, Credentials + JWT) · bcryptjs · Vitest · Docker / Docker Compose

## Global Constraints

- Node.js 20 LTS. TypeScript em modo `strict`, sem `any` implícito.
- Next.js **App Router** (não usar Pages Router).
- Todo texto de interface, nomes de campos de domínio e mensagens de commit em **Português (pt-BR)**.
- Regras de negócio (capacidade de mesa, política de cancelamento, cálculo de preço) são **funções puras**, sem I/O, sempre testadas por unidade.
- Nesta fase, nenhum adaptador chama serviço externo real — todos usam implementação mock/log/fallback (ver spec, seção "Adaptadores plugáveis").
- Acesso ao banco **somente via Prisma Client** (`src/lib/db.ts`) — nunca SQL solto fora de arquivos de migration.
- Todo teste roda via `npm test` (Vitest) e deve passar antes de qualquer commit.
- Taxa de serviço padrão dos pacotes de evento: **10%** (`taxaServicoPct`), valor do equipamento opcional Telão & Projetor: **R$ 500,00** — valores vindos do PDF de pacotes, não inventar outros.

---

## Visão geral dos arquivos

```
docker-compose.yml
Dockerfile.dev
.dockerignore
.env.example
package.json
tsconfig.json
next.config.mjs
vitest.config.ts
prisma/
  schema.prisma
  seed.ts
src/
  app/
    layout.tsx
    page.tsx
    api/
      health/route.ts
      auth/[...nextauth]/route.ts
  lib/
    db.ts
    auth.ts
    domain/
      tableFit.ts
      refundPolicy.ts
      eventPricing.ts
    auth/
      password.ts
      roles.ts
      authenticate.ts
  providers/
    payment/
      PaymentProvider.ts
      MockPaymentProvider.ts
    notification/
      NotificationProvider.ts
      LogNotificationProvider.ts
    tableMap/
      TableMapProvider.ts
      FallbackMapProvider.ts
```

Cada arquivo de código tem um `.test.ts` colocado ao lado (ex: `tableFit.ts` + `tableFit.test.ts`) — é o padrão idiomático em projetos Vitest/TypeScript e evita que quem for implementar precise caçar o teste em outra pasta.

---

### Task 1: Scaffold do projeto Next.js + Docker

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `.dockerignore`
- Create: `docker-compose.yml`, `Dockerfile.dev`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Interfaces:**
- Produces: rota HTTP `GET /api/health` retornando `{ status: "ok" }`; stack Docker com serviços `db` (Postgres) e `app` (Next.js).

- [ ] **Step 1: Criar arquivos de configuração do projeto**

`package.json`:
```json
{
  "name": "antonina-osteria-reservas",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "vitest": "^1.6.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

`.gitignore`:
```
node_modules
.next
.env
*.log
```

`.dockerignore`:
```
node_modules
.next
.git
*.log
```

- [ ] **Step 2: Criar layout e página inicial mínima**

`src/app/layout.tsx`:
```tsx
export const metadata = {
  title: "Antonina Osteria",
  description: "Reservas de mesa e eventos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main>Antonina Osteria</main>;
}
```

- [ ] **Step 3: Escrever o teste que falha para a rota de health check**

`src/app/api/health/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("retorna status ok", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 4: Instalar dependências e rodar o teste para confirmar que falha**

Run: `npm install && npm test`
Expected: FAIL — `route.ts` ainda não existe (erro de import/módulo não encontrado).

- [ ] **Step 5: Implementar a rota de health check**

`src/app/api/health/route.ts`:
```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
```

- [ ] **Step 6: Rodar o teste novamente e confirmar que passa**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Criar o stack Docker**

`Dockerfile.dev`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: antonina
      POSTGRES_PASSWORD: antonina_dev_password
      POSTGRES_DB: antonina_dev
    ports:
      - "5432:5432"
    volumes:
      - antonina_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U antonina -d antonina_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://antonina:antonina_dev_password@db:5432/antonina_dev
      NEXTAUTH_SECRET: dev_secret_change_in_production
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next

volumes:
  antonina_pgdata:
```

**Por que os volumes `/app/node_modules` e `/app/.next` existem separados:** o bind mount `.:/app` sobrepõe todo o conteúdo do host em cima do container — sem esses dois volumes anônimos, o `node_modules` instalado dentro da imagem (Linux) seria substituído pelo `node_modules` do host (Windows), quebrando pacotes nativos. Isso é a causa mais comum de `MODULE_NOT_FOUND` em setups Docker + bind mount.

`.env.example` (usado pelos comandos rodados no host — Prisma CLI, `npm test` — que enxergam o Postgres do container via a porta publicada):
```
DATABASE_URL="postgresql://antonina:antonina_dev_password@localhost:5432/antonina_dev"
NEXTAUTH_SECRET="dev_secret_change_in_production"
NEXTAUTH_URL="http://localhost:3000"
```

Copie `.env.example` para `.env` antes de continuar (o `.env` real não vai pro git).

- [ ] **Step 8: Subir o stack Docker e verificar o health check pelo container**

Run: `docker compose up -d --build`
Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json next.config.mjs vitest.config.ts .gitignore .dockerignore docker-compose.yml Dockerfile.dev .env.example src/
git commit -m "feat: scaffold do projeto Next.js com Docker e health check"
```

---

### Task 2: Schema do banco de dados (Prisma)

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json` (scripts de banco + config de seed)
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `.env` do Task 1 (`DATABASE_URL`).
- Produces: `prisma` (Prisma Client singleton) exportado de `src/lib/db.ts`; modelos `Ambiente`, `Mesa`, `ReservaMesa`, `Pacote`, `ReservaEvento`, `Pagamento`, `PoliticaCancelamento`, `AdminUser`.

- [ ] **Step 1: Instalar Prisma e dependências de seed**

Run: `npm install prisma --save-dev && npm install @prisma/client bcryptjs && npm install --save-dev tsx @types/bcryptjs`
Run: `npx prisma init --datasource-provider postgresql`

Isso cria `prisma/schema.prisma` (sobrescreva com o conteúdo abaixo) e um `.env` — mantenha o `.env` já criado no Task 1.

- [ ] **Step 2: Escrever o schema completo**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AdminRole {
  DONO
  RECEPCAO
}

enum StatusReservaMesa {
  CONFIRMADA
  CANCELADA
  NO_SHOW
}

enum TipoEvento {
  CORPORATIVO
  ANIVERSARIO
  JANTAR_RESERVADO
  OUTRO
}

enum StatusReservaEvento {
  AGUARDANDO_PAGAMENTO
  CONFIRMADA
  CANCELADA
}

enum MetodoPagamentoEnum {
  PIX
  CARTAO
}

enum StatusPagamento {
  PENDENTE
  APROVADO
  RECUSADO
}

model Ambiente {
  id              String   @id @default(cuid())
  nome            String   @unique
  mattertagRoomId String?
  mesas           Mesa[]
  createdAt       DateTime @default(now())
}

model Mesa {
  id                String        @id @default(cuid())
  numero            String
  capacidadeLugares Int
  posicaoTour       String?
  ativa             Boolean       @default(true)
  ambiente          Ambiente      @relation(fields: [ambienteId], references: [id])
  ambienteId        String
  reservas          ReservaMesa[]
  createdAt         DateTime      @default(now())

  @@unique([ambienteId, numero])
}

model ReservaMesa {
  id             String            @id @default(cuid())
  mesa           Mesa              @relation(fields: [mesaId], references: [id])
  mesaId         String
  nomeCliente    String
  telefone       String
  data           DateTime          @db.Date
  horarioChegada String
  numPessoas     Int
  status         StatusReservaMesa @default(CONFIRMADA)
  createdAt      DateTime          @default(now())
}

model Pacote {
  id             String          @id @default(cuid())
  nome           String          @unique
  precoPessoa    Decimal?        @db.Decimal(10, 2)
  taxaServicoPct Decimal         @db.Decimal(5, 2) @default(10.00)
  reservasEvento ReservaEvento[]
  createdAt      DateTime        @default(now())
}

model ReservaEvento {
  id               String              @id @default(cuid())
  clienteNome      String
  clienteTelefone  String
  clienteEmail     String
  tipoEvento       TipoEvento
  data             DateTime            @db.Date
  numConvidados    Int
  pacote           Pacote?             @relation(fields: [pacoteId], references: [id])
  pacoteId         String?
  cardapioAberto   Boolean             @default(false)
  equipamentoTelao Boolean             @default(false)
  valorTotal       Decimal             @db.Decimal(10, 2)
  percentualSinal  Decimal             @db.Decimal(5, 2) @default(100.00)
  status           StatusReservaEvento @default(AGUARDANDO_PAGAMENTO)
  holdExpiresAt    DateTime?
  pratosEscolhidos Json?
  pagamento        Pagamento?
  createdAt        DateTime            @default(now())
}

model Pagamento {
  id              String              @id @default(cuid())
  reservaEvento   ReservaEvento       @relation(fields: [reservaEventoId], references: [id])
  reservaEventoId String              @unique
  provedor        String
  metodo          MetodoPagamentoEnum
  valor           Decimal             @db.Decimal(10, 2)
  status          StatusPagamento     @default(PENDENTE)
  createdAt       DateTime            @default(now())
}

model PoliticaCancelamento {
  id                  String  @id @default(cuid())
  diasMinimos         Int
  diasMaximos         Int?
  percentualReembolso Decimal @db.Decimal(5, 2)
}

model AdminUser {
  id        String    @id @default(cuid())
  nome      String
  email     String    @unique
  senhaHash String
  role      AdminRole
  createdAt DateTime  @default(now())
}
```

**Nota deliberada:** não existem modelos `Account`/`Session`/`VerificationToken` do Auth.js — a autenticação usa estratégia JWT (Task 9), sem adapter de banco para sessão, então essas tabelas não são necessárias e reduziriam o schema à toa se fossem adicionadas agora.

- [ ] **Step 3: Gerar a migração inicial sem aplicar ainda**

Run: `npx prisma migrate dev --name init --create-only`

Isso cria `prisma/migrations/<timestamp>_init/migration.sql` com o SQL gerado a partir do schema, sem tocar no banco ainda.

- [ ] **Step 4: Adicionar os índices únicos parciais no arquivo de migração gerado**

Abra o arquivo `prisma/migrations/<timestamp>_init/migration.sql` criado no passo anterior e acrescente ao final:

```sql
-- Uma mesa só pode ter uma reserva CONFIRMADA por noite (mesa é do grupo a noite toda).
-- Reservas CANCELADA/NO_SHOW não contam, então a mesa libera para nova reserva.
CREATE UNIQUE INDEX "reserva_mesa_unica_confirmada_por_noite"
ON "ReservaMesa" ("mesaId", "data")
WHERE "status" = 'CONFIRMADA';

-- Só pode existir um evento CONFIRMADO por dia no mezanino.
CREATE UNIQUE INDEX "reserva_evento_unica_confirmada_por_dia"
ON "ReservaEvento" ("data")
WHERE "status" = 'CONFIRMADA';
```

**Por que isso não está no `schema.prisma`:** o Prisma Schema Language não suporta índices únicos parciais (`WHERE`) nativamente — por isso o índice é escrito à mão na migração, uma única vez, e o Prisma Client continua funcionando normalmente (ele só não sabe validar essa regra em memória, o banco que garante).

- [ ] **Step 5: Aplicar a migração no banco (Docker precisa estar rodando)**

Run: `docker compose up -d db`
Run: `npx prisma migrate dev`
Expected: mensagem confirmando que a migração `init` foi aplicada.

- [ ] **Step 6: Criar o cliente Prisma singleton**

`src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Por que o singleton:** em desenvolvimento, o hot-reload do Next.js re-executa módulos a cada mudança de arquivo; sem guardar a instância em `globalThis`, cada reload criaria um novo `PrismaClient` e uma nova pool de conexões, esgotando as conexões do Postgres rapidamente.

- [ ] **Step 7: Escrever o teste de integração que falha (banco ainda sem dados de teste)**

`src/lib/db.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./db";

describe("prisma client", () => {
  afterEach(async () => {
    await prisma.ambiente.deleteMany({ where: { nome: "Ambiente de Teste" } });
  });

  it("cria e lê um Ambiente no banco real", async () => {
    const criado = await prisma.ambiente.create({
      data: { nome: "Ambiente de Teste" },
    });

    const encontrado = await prisma.ambiente.findUnique({
      where: { id: criado.id },
    });

    expect(encontrado?.nome).toBe("Ambiente de Teste");
  });
});
```

- [ ] **Step 8: Rodar o teste e confirmar que passa (banco já está migrado)**

Run: `npm test`
Expected: PASS — se falhar com erro de conexão, confirme que `docker compose up -d db` está rodando e que `.env` aponta para `localhost:5432`.

- [ ] **Step 9: Criar o script de seed**

`prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const deck = await prisma.ambiente.upsert({
    where: { nome: "Deck" },
    update: {},
    create: { nome: "Deck" },
  });

  const salaoPrincipal = await prisma.ambiente.upsert({
    where: { nome: "Salão Principal" },
    update: {},
    create: { nome: "Salão Principal" },
  });

  const mezanino = await prisma.ambiente.upsert({
    where: { nome: "Mezanino" },
    update: {},
    create: { nome: "Mezanino" },
  });

  await prisma.mesa.upsert({
    where: { ambienteId_numero: { ambienteId: deck.id, numero: "D01" } },
    update: {},
    create: { ambienteId: deck.id, numero: "D01", capacidadeLugares: 4 },
  });

  await prisma.mesa.upsert({
    where: { ambienteId_numero: { ambienteId: salaoPrincipal.id, numero: "03" } },
    update: {},
    create: { ambienteId: salaoPrincipal.id, numero: "03", capacidadeLugares: 6 },
  });

  await prisma.mesa.upsert({
    where: { ambienteId_numero: { ambienteId: mezanino.id, numero: "M01" } },
    update: {},
    create: { ambienteId: mezanino.id, numero: "M01", capacidadeLugares: 12 },
  });

  await prisma.pacote.upsert({
    where: { nome: "Clássico" },
    update: {},
    create: { nome: "Clássico", precoPessoa: 197.0, taxaServicoPct: 10.0 },
  });

  await prisma.pacote.upsert({
    where: { nome: "Premium" },
    update: {},
    create: { nome: "Premium", precoPessoa: 250.0, taxaServicoPct: 10.0 },
  });

  await prisma.pacote.upsert({
    where: { nome: "L'Esperienza" },
    update: {},
    create: { nome: "L'Esperienza", precoPessoa: 297.0, taxaServicoPct: 10.0 },
  });

  await prisma.pacote.upsert({
    where: { nome: "Cardápio Aberto" },
    update: {},
    create: { nome: "Cardápio Aberto", precoPessoa: null, taxaServicoPct: 10.0 },
  });

  const tiers: Array<{ diasMinimos: number; diasMaximos: number | null; percentualReembolso: number }> = [
    { diasMinimos: 15, diasMaximos: null, percentualReembolso: 100 },
    { diasMinimos: 8, diasMaximos: 14, percentualReembolso: 75 },
    { diasMinimos: 4, diasMaximos: 7, percentualReembolso: 50 },
    { diasMinimos: 2, diasMaximos: 3, percentualReembolso: 25 },
    { diasMinimos: 0, diasMaximos: 1, percentualReembolso: 0 },
  ];

  await prisma.politicaCancelamento.deleteMany();
  await prisma.politicaCancelamento.createMany({ data: tiers });

  const senhaHash = await bcrypt.hash("trocar-esta-senha", 10);
  await prisma.adminUser.upsert({
    where: { email: "dono@antoninaosteria.com" },
    update: {},
    create: {
      nome: "Dono Antonina Osteria",
      email: "dono@antoninaosteria.com",
      senhaHash,
      role: "DONO",
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 10: Registrar os scripts de banco no `package.json`**

Adicione ao `package.json`:
```json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 11: Rodar o seed e confirmar**

Run: `npm run db:seed`
Expected: `Seed concluído.` impresso no terminal, sem erro.

- [ ] **Step 12: Commit**

```bash
git add prisma/ src/lib/db.ts src/lib/db.test.ts package.json package-lock.json
git commit -m "feat: schema do banco, migração com índices únicos parciais e seed"
```

---

### Task 3: Regra de negócio — faixa de encaixe de capacidade da mesa

**Files:**
- Create: `src/lib/domain/tableFit.ts`
- Test: `src/lib/domain/tableFit.test.ts`

**Interfaces:**
- Produces: `classificarMesasPorCapacidade(mesas, numPessoas)`, `selecionarMesasParaExibir(mesas, numPessoas)`, tipos `MesaCandidata`, `MesaClassificada`, constante `TOLERANCIA_LUGARES_EXTRAS`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/domain/tableFit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classificarMesasPorCapacidade, selecionarMesasParaExibir } from "./tableFit";

describe("classificarMesasPorCapacidade", () => {
  it("classifica mesa dentro da tolerância como ideal", () => {
    const mesas = [{ id: "1", capacidadeLugares: 4 }];
    expect(classificarMesasPorCapacidade(mesas, 2)).toEqual([
      { id: "1", capacidadeLugares: 4, faixa: "ideal" },
    ]);
  });

  it("classifica mesa muito maior que o grupo como alternativa", () => {
    const mesas = [{ id: "1", capacidadeLugares: 12 }];
    expect(classificarMesasPorCapacidade(mesas, 2)).toEqual([
      { id: "1", capacidadeLugares: 12, faixa: "alternativa" },
    ]);
  });

  it("exclui mesas menores que o grupo", () => {
    const mesas = [{ id: "1", capacidadeLugares: 2 }];
    expect(classificarMesasPorCapacidade(mesas, 4)).toEqual([]);
  });
});

describe("selecionarMesasParaExibir", () => {
  it("retorna só mesas ideais quando existem", () => {
    const mesas = [
      { id: "1", capacidadeLugares: 4 },
      { id: "2", capacidadeLugares: 12 },
    ];
    expect(selecionarMesasParaExibir(mesas, 2)).toEqual([
      { id: "1", capacidadeLugares: 4, faixa: "ideal" },
    ]);
  });

  it("libera mesas alternativas quando não há mesa ideal disponível", () => {
    const mesas = [{ id: "2", capacidadeLugares: 12 }];
    expect(selecionarMesasParaExibir(mesas, 2)).toEqual([
      { id: "2", capacidadeLugares: 12, faixa: "alternativa" },
    ]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- tableFit`
Expected: FAIL — `./tableFit` não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/tableFit.ts`:
```ts
export const TOLERANCIA_LUGARES_EXTRAS = 2;

export interface MesaCandidata {
  id: string;
  capacidadeLugares: number;
}

export interface MesaClassificada extends MesaCandidata {
  faixa: "ideal" | "alternativa";
}

export function classificarMesasPorCapacidade(
  mesas: MesaCandidata[],
  numPessoas: number
): MesaClassificada[] {
  return mesas
    .filter((mesa) => mesa.capacidadeLugares >= numPessoas)
    .map((mesa) => ({
      ...mesa,
      faixa: (mesa.capacidadeLugares <= numPessoas + TOLERANCIA_LUGARES_EXTRAS
        ? "ideal"
        : "alternativa") as "ideal" | "alternativa",
    }))
    .sort((a, b) => a.capacidadeLugares - b.capacidadeLugares);
}

export function selecionarMesasParaExibir(
  mesas: MesaCandidata[],
  numPessoas: number
): MesaClassificada[] {
  const classificadas = classificarMesasPorCapacidade(mesas, numPessoas);
  const ideais = classificadas.filter((mesa) => mesa.faixa === "ideal");
  return ideais.length > 0 ? ideais : classificadas;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- tableFit`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/tableFit.ts src/lib/domain/tableFit.test.ts
git commit -m "feat: regra de faixa de encaixe de capacidade da mesa"
```

---

### Task 4: Regra de negócio — cálculo de percentual de reembolso

**Files:**
- Create: `src/lib/domain/refundPolicy.ts`
- Test: `src/lib/domain/refundPolicy.test.ts`

**Interfaces:**
- Produces: `calcularPercentualReembolso(diasAteEvento, tiers?)`, tipo `PoliticaCancelamentoTier`, constante `POLITICA_CANCELAMENTO_PADRAO`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/domain/refundPolicy.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcularPercentualReembolso } from "./refundPolicy";

describe("calcularPercentualReembolso", () => {
  it.each([
    [20, 100],
    [15, 100],
    [14, 75],
    [8, 75],
    [7, 50],
    [4, 50],
    [3, 25],
    [2, 25],
    [1, 0],
    [0, 0],
  ])("com %i dias de antecedência retorna %i%% de reembolso", (dias, esperado) => {
    expect(calcularPercentualReembolso(dias)).toBe(esperado);
  });

  it("lança erro para número de dias negativo", () => {
    expect(() => calcularPercentualReembolso(-1)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- refundPolicy`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/refundPolicy.ts`:
```ts
export interface PoliticaCancelamentoTier {
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: number;
}

export const POLITICA_CANCELAMENTO_PADRAO: PoliticaCancelamentoTier[] = [
  { diasMinimos: 15, diasMaximos: null, percentualReembolso: 100 },
  { diasMinimos: 8, diasMaximos: 14, percentualReembolso: 75 },
  { diasMinimos: 4, diasMaximos: 7, percentualReembolso: 50 },
  { diasMinimos: 2, diasMaximos: 3, percentualReembolso: 25 },
  { diasMinimos: 0, diasMaximos: 1, percentualReembolso: 0 },
];

export function calcularPercentualReembolso(
  diasAteEvento: number,
  tiers: PoliticaCancelamentoTier[] = POLITICA_CANCELAMENTO_PADRAO
): number {
  if (diasAteEvento < 0) {
    throw new Error("diasAteEvento não pode ser negativo");
  }

  const tier = tiers.find((t) =>
    t.diasMaximos === null
      ? diasAteEvento >= t.diasMinimos
      : diasAteEvento >= t.diasMinimos && diasAteEvento <= t.diasMaximos
  );

  if (!tier) {
    throw new Error(`Nenhuma faixa de política de cancelamento cobre ${diasAteEvento} dias`);
  }

  return tier.percentualReembolso;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- refundPolicy`
Expected: PASS (11 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/refundPolicy.ts src/lib/domain/refundPolicy.test.ts
git commit -m "feat: regra de cálculo de percentual de reembolso"
```

---

### Task 5: Regra de negócio — cálculo do valor total do evento

**Files:**
- Create: `src/lib/domain/eventPricing.ts`
- Test: `src/lib/domain/eventPricing.test.ts`

**Interfaces:**
- Produces: `calcularValorTotalEvento(input)`, tipo `CalculoValorEventoInput`, constante `VALOR_TELAO_PROJETOR`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/domain/eventPricing.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calcularValorTotalEvento } from "./eventPricing";

describe("calcularValorTotalEvento", () => {
  it("calcula pacote Clássico para 10 pessoas com taxa de 10%", () => {
    const total = calcularValorTotalEvento({
      precoPessoa: 197,
      numConvidados: 10,
      taxaServicoPct: 10,
      equipamentoTelao: false,
    });
    expect(total).toBe(2167.0);
  });

  it("soma o valor do telão quando selecionado", () => {
    const total = calcularValorTotalEvento({
      precoPessoa: 197,
      numConvidados: 10,
      taxaServicoPct: 10,
      equipamentoTelao: true,
    });
    expect(total).toBe(2667.0);
  });

  it("arredonda para duas casas decimais", () => {
    const total = calcularValorTotalEvento({
      precoPessoa: 33.33,
      numConvidados: 3,
      taxaServicoPct: 10,
      equipamentoTelao: false,
    });
    expect(total).toBe(109.99);
  });

  it("lança erro se número de convidados for zero ou negativo", () => {
    expect(() =>
      calcularValorTotalEvento({
        precoPessoa: 197,
        numConvidados: 0,
        taxaServicoPct: 10,
        equipamentoTelao: false,
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventPricing`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/eventPricing.ts`:
```ts
export interface CalculoValorEventoInput {
  precoPessoa: number;
  numConvidados: number;
  taxaServicoPct: number;
  equipamentoTelao: boolean;
}

export const VALOR_TELAO_PROJETOR = 500;

export function calcularValorTotalEvento(input: CalculoValorEventoInput): number {
  const { precoPessoa, numConvidados, taxaServicoPct, equipamentoTelao } = input;

  if (numConvidados <= 0) {
    throw new Error("numConvidados deve ser maior que zero");
  }

  const subtotalPratos = precoPessoa * numConvidados;
  const totalComTaxa = subtotalPratos * (1 + taxaServicoPct / 100);
  const totalComEquipamento = totalComTaxa + (equipamentoTelao ? VALOR_TELAO_PROJETOR : 0);

  return Math.round(totalComEquipamento * 100) / 100;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventPricing`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/eventPricing.ts src/lib/domain/eventPricing.test.ts
git commit -m "feat: regra de cálculo do valor total do evento"
```

---

### Task 6: Adaptador de pagamento (`PaymentProvider`)

**Files:**
- Create: `src/providers/payment/PaymentProvider.ts`
- Create: `src/providers/payment/MockPaymentProvider.ts`
- Test: `src/providers/payment/MockPaymentProvider.test.ts`

**Interfaces:**
- Produces: interface `PaymentProvider`, classe `MockPaymentProvider`, tipos `IniciarPagamentoInput`, `ResultadoPagamento`, `MetodoPagamento`.

- [ ] **Step 1: Escrever o teste que falha**

`src/providers/payment/MockPaymentProvider.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MockPaymentProvider } from "./MockPaymentProvider";

describe("MockPaymentProvider", () => {
  it("aprova pagamento com valor válido", async () => {
    const provider = new MockPaymentProvider();
    const resultado = await provider.iniciarPagamento({
      reservaEventoId: "evt_1",
      valor: 100,
      metodo: "pix",
    });

    expect(resultado.status).toBe("aprovado");
    expect(resultado.provedor).toBe("mock");
    expect(resultado.referenciaExterna).toContain("evt_1");
  });

  it("lança erro para valor zero ou negativo", async () => {
    const provider = new MockPaymentProvider();
    await expect(
      provider.iniciarPagamento({ reservaEventoId: "evt_1", valor: 0, metodo: "pix" })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- MockPaymentProvider`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a interface e o mock**

`src/providers/payment/PaymentProvider.ts`:
```ts
export type MetodoPagamento = "pix" | "cartao";

export interface IniciarPagamentoInput {
  reservaEventoId: string;
  valor: number;
  metodo: MetodoPagamento;
}

export interface ResultadoPagamento {
  provedor: string;
  status: "aprovado" | "recusado" | "pendente";
  referenciaExterna: string;
}

export interface PaymentProvider {
  nome: string;
  iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento>;
}
```

`src/providers/payment/MockPaymentProvider.ts`:
```ts
import { PaymentProvider, IniciarPagamentoInput, ResultadoPagamento } from "./PaymentProvider";

export class MockPaymentProvider implements PaymentProvider {
  nome = "mock";

  async iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento> {
    if (input.valor <= 0) {
      throw new Error("valor do pagamento deve ser maior que zero");
    }

    return {
      provedor: this.nome,
      status: "aprovado",
      referenciaExterna: `mock_${input.reservaEventoId}_${Date.now()}`,
    };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- MockPaymentProvider`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/providers/payment/
git commit -m "feat: adaptador de pagamento com implementação mock"
```

---

### Task 7: Adaptador de notificação (`NotificationProvider`)

**Files:**
- Create: `src/providers/notification/NotificationProvider.ts`
- Create: `src/providers/notification/LogNotificationProvider.ts`
- Test: `src/providers/notification/LogNotificationProvider.test.ts`

**Interfaces:**
- Produces: interface `NotificationProvider`, classe `LogNotificationProvider`, tipo `NotificacaoInput`.

- [ ] **Step 1: Escrever o teste que falha**

`src/providers/notification/LogNotificationProvider.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LogNotificationProvider } from "./LogNotificationProvider";

describe("LogNotificationProvider", () => {
  it("registra a notificação enviada em memória", async () => {
    const provider = new LogNotificationProvider();
    await provider.enviar({ telefone: "+5541999999999", mensagem: "Reserva confirmada" });

    expect(provider.enviados).toHaveLength(1);
    expect(provider.enviados[0]).toEqual({
      telefone: "+5541999999999",
      mensagem: "Reserva confirmada",
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- LogNotificationProvider`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/providers/notification/NotificationProvider.ts`:
```ts
export interface NotificacaoInput {
  telefone: string;
  mensagem: string;
}

export interface NotificationProvider {
  nome: string;
  enviar(input: NotificacaoInput): Promise<void>;
}
```

`src/providers/notification/LogNotificationProvider.ts`:
```ts
import { NotificationProvider, NotificacaoInput } from "./NotificationProvider";

export class LogNotificationProvider implements NotificationProvider {
  nome = "log";
  public enviados: NotificacaoInput[] = [];

  async enviar(input: NotificacaoInput): Promise<void> {
    this.enviados.push(input);
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- LogNotificationProvider`
Expected: PASS (1 teste)

- [ ] **Step 5: Commit**

```bash
git add src/providers/notification/
git commit -m "feat: adaptador de notificação com implementação de log"
```

---

### Task 8: Adaptador de mapa de mesas (`TableMapProvider`)

**Files:**
- Create: `src/providers/tableMap/TableMapProvider.ts`
- Create: `src/providers/tableMap/FallbackMapProvider.ts`
- Test: `src/providers/tableMap/FallbackMapProvider.test.ts`

**Interfaces:**
- Produces: interface `TableMapProvider`, classe `FallbackMapProvider`, tipo `ZonaClicavel`.

- [ ] **Step 1: Escrever o teste que falha**

`src/providers/tableMap/FallbackMapProvider.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { FallbackMapProvider } from "./FallbackMapProvider";

describe("FallbackMapProvider", () => {
  const zonas = {
    ambiente_deck: [
      { mesaId: "mesa_1", numero: "D01", coordenadas: { x: 10, y: 20, largura: 50, altura: 50 } },
    ],
  };

  it("retorna as zonas clicáveis cadastradas para o ambiente", async () => {
    const provider = new FallbackMapProvider(zonas);
    const resultado = await provider.obterZonasClicaveis("ambiente_deck");
    expect(resultado).toEqual(zonas.ambiente_deck);
  });

  it("retorna lista vazia para ambiente sem zonas cadastradas", async () => {
    const provider = new FallbackMapProvider(zonas);
    const resultado = await provider.obterZonasClicaveis("ambiente_inexistente");
    expect(resultado).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- FallbackMapProvider`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/providers/tableMap/TableMapProvider.ts`:
```ts
export interface ZonaClicavel {
  mesaId: string;
  numero: string;
  coordenadas: { x: number; y: number; largura: number; altura: number };
}

export interface TableMapProvider {
  nome: string;
  obterZonasClicaveis(ambienteId: string): Promise<ZonaClicavel[]>;
}
```

`src/providers/tableMap/FallbackMapProvider.ts`:
```ts
import { TableMapProvider, ZonaClicavel } from "./TableMapProvider";

export class FallbackMapProvider implements TableMapProvider {
  nome = "fallback";

  constructor(private readonly zonasPorAmbiente: Record<string, ZonaClicavel[]>) {}

  async obterZonasClicaveis(ambienteId: string): Promise<ZonaClicavel[]> {
    return this.zonasPorAmbiente[ambienteId] ?? [];
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- FallbackMapProvider`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/providers/tableMap/
git commit -m "feat: adaptador de mapa de mesas com fallback clicável"
```

---

### Task 9: Autenticação — senha, permissões e verificação de credenciais

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/roles.ts`
- Create: `src/lib/auth/authenticate.ts`
- Test: `src/lib/auth/password.test.ts`
- Test: `src/lib/auth/roles.test.ts`
- Test: `src/lib/auth/authenticate.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), seed `dono@antoninaosteria.com` (Task 2).
- Produces: `hashSenha`, `verificarSenha`, `verificarPermissao`, `AcessoNegadoError`, tipo `AdminRole`, `autenticarAdmin`, tipo `AdminSessionData`.

- [ ] **Step 1: Escrever o teste de hash de senha que falha**

`src/lib/auth/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashSenha, verificarSenha } from "./password";

describe("hashSenha / verificarSenha", () => {
  it("gera hash diferente do texto original", async () => {
    const hash = await hashSenha("minhasenha123");
    expect(hash).not.toBe("minhasenha123");
  });

  it("verifica senha correta como válida", async () => {
    const hash = await hashSenha("minhasenha123");
    expect(await verificarSenha("minhasenha123", hash)).toBe(true);
  });

  it("rejeita senha incorreta", async () => {
    const hash = await hashSenha("minhasenha123");
    expect(await verificarSenha("senhaerrada", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha, depois implementar**

Run: `npm test -- password`
Expected: FAIL

`src/lib/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, SALT_ROUNDS);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
```

Run: `npm test -- password`
Expected: PASS (3 testes)

- [ ] **Step 3: Escrever o teste de permissões que falha**

`src/lib/auth/roles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { verificarPermissao, AcessoNegadoError } from "./roles";

describe("verificarPermissao", () => {
  it("permite quando o perfil está na lista de permitidos", () => {
    expect(() => verificarPermissao("DONO", ["DONO"])).not.toThrow();
  });

  it("permite Recepção quando Recepção está entre os permitidos", () => {
    expect(() => verificarPermissao("RECEPCAO", ["DONO", "RECEPCAO"])).not.toThrow();
  });

  it("nega Recepção quando só Dono é permitido", () => {
    expect(() => verificarPermissao("RECEPCAO", ["DONO"])).toThrow(AcessoNegadoError);
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha, depois implementar**

Run: `npm test -- roles`
Expected: FAIL

`src/lib/auth/roles.ts`:
```ts
export type AdminRole = "DONO" | "RECEPCAO";

export class AcessoNegadoError extends Error {
  constructor(role: AdminRole, permitido: AdminRole[]) {
    super(`Acesso negado: perfil ${role} não está entre os permitidos (${permitido.join(", ")})`);
    this.name = "AcessoNegadoError";
  }
}

export function verificarPermissao(role: AdminRole, permitido: AdminRole[]): void {
  if (!permitido.includes(role)) {
    throw new AcessoNegadoError(role, permitido);
  }
}
```

Run: `npm test -- roles`
Expected: PASS (3 testes)

- [ ] **Step 5: Escrever o teste de autenticação que falha (integração com o banco real)**

`src/lib/auth/authenticate.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashSenha } from "./password";
import { autenticarAdmin } from "./authenticate";

describe("autenticarAdmin", () => {
  const email = "teste.fundacao@antoninaosteria.com";
  const senha = "senhaDeTeste123";

  beforeAll(async () => {
    await prisma.adminUser.create({
      data: {
        nome: "Usuário de Teste",
        email,
        senhaHash: await hashSenha(senha),
        role: "DONO",
      },
    });
  });

  afterAll(async () => {
    await prisma.adminUser.delete({ where: { email } });
  });

  it("retorna dados da sessão com credenciais corretas", async () => {
    const resultado = await autenticarAdmin(email, senha);
    expect(resultado).toMatchObject({ email, role: "DONO" });
  });

  it("retorna null com senha incorreta", async () => {
    expect(await autenticarAdmin(email, "senhaErrada")).toBeNull();
  });

  it("retorna null para e-mail inexistente", async () => {
    expect(await autenticarAdmin("naoexiste@antoninaosteria.com", senha)).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha (Docker precisa estar rodando), depois implementar**

Run: `docker compose up -d db && npm test -- authenticate`
Expected: FAIL — módulo não existe.

`src/lib/auth/authenticate.ts`:
```ts
import { prisma } from "@/lib/db";
import { verificarSenha } from "./password";
import { AdminRole } from "./roles";

export interface AdminSessionData {
  id: string;
  nome: string;
  email: string;
  role: AdminRole;
}

export async function autenticarAdmin(
  email: string,
  senha: string
): Promise<AdminSessionData | null> {
  const usuario = await prisma.adminUser.findUnique({ where: { email } });

  if (!usuario) {
    return null;
  }

  const senhaValida = await verificarSenha(senha, usuario.senhaHash);

  if (!senhaValida) {
    return null;
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role as AdminRole,
  };
}
```

Run: `npm test -- authenticate`
Expected: PASS (3 testes)

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/
git commit -m "feat: autenticação de admin com hash de senha e verificação de permissões"
```

---

### Task 10: Integração do Auth.js e verificação completa da fundação

**Files:**
- Install: `next-auth@beta`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `autenticarAdmin` (Task 9), `/api/health` (Task 1), stack Docker completo (Task 1 + Task 2).
- Produces: `handlers`, `auth`, `signIn`, `signOut` exportados de `src/lib/auth.ts`, usados pelos planos seguintes (Painel Admin) para proteger rotas.

- [ ] **Step 1: Instalar o Auth.js**

Run: `npm install next-auth@beta`

- [ ] **Step 2: Configurar o Auth.js usando `autenticarAdmin`**

`src/lib/auth.ts`:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { autenticarAdmin } from "@/lib/auth/authenticate";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) {
          return null;
        }

        const sessao = await autenticarAdmin(
          credentials.email as string,
          credentials.senha as string
        );

        if (!sessao) {
          return null;
        }

        return {
          id: sessao.id,
          name: sessao.nome,
          email: sessao.email,
          role: sessao.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
```

`src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Verificação manual completa da fundação (checklist, não é teste automatizado)**

Esta etapa confirma que tudo construído nas Tasks 1-10 funciona junto, do zero, exatamente como vai rodar em desenvolvimento:

Run: `docker compose down -v` (garante estado limpo, sem volume antigo)
Run: `docker compose up -d --build`
Run: `npx prisma migrate dev`
Run: `npm run db:seed`
Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`

Run: `npm test`
Expected: todos os testes das Tasks 1-9 passam (rodando contra o Postgres do Docker).

Confirme manualmente que existe um `AdminUser` com `email=dono@antoninaosteria.com` e `role=DONO` no banco:
Run: `npx prisma studio` e inspecione a tabela `AdminUser` (ou `npx prisma db execute --stdin` com `SELECT email, role FROM "AdminUser";`)

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ package.json package-lock.json
git commit -m "feat: integra Auth.js com autenticação de admin via credenciais"
```

---

## Checklist final da fundação

**Atenção:** se você já subiu o stack antes (mesmo com uma versão quebrada do `Dockerfile.dev`), rode `docker compose down` antes de `--build` — o volume anônimo de `node_modules` do container sobrevive a um rebuild simples e pode manter um Prisma Client desatualizado/quebrado mesmo depois de corrigir o Dockerfile.

- [ ] `docker compose up -d --build` sobe `db` e `app` sem erro
- [ ] `npm test` passa 100% (todas as Tasks 1-9)
- [ ] `curl http://localhost:3000/api/health` retorna `{"status":"ok"}`
- [ ] `npm run db:seed` roda sem erro e popula Ambientes, Mesas, Pacotes, Política de Cancelamento e o usuário Dono
- [ ] Os dois índices únicos parciais (`reserva_mesa_unica_confirmada_por_noite`, `reserva_evento_unica_confirmada_por_dia`) existem no banco — confirme com `\d "ReservaMesa"` e `\d "ReservaEvento"` via `psql` ou Prisma Studio

Com isso pronto, os próximos planos (Reserva de Mesa Diária, Reserva de Evento, Painel Admin) constroem em cima desta base sem precisar reabrir nenhuma decisão de infraestrutura.
