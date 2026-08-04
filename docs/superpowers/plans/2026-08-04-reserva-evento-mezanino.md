# Reserva de Evento no Mezanino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o fluxo completo de reserva de evento no mezanino — calendário de disponibilidade, escolha de pacote (ou pedido de orçamento para Cardápio Aberto), checkout automático com pagamento mock, hold temporário de 15 minutos contra dupla reserva de data, ciência do Art. 49 do CDC, escolha dos pratos pós-pagamento e cancelamento com reembolso proporcional.

**Architecture:** Route Handlers do Next.js, reaproveitando os adaptadores e regras puras da Fundação (`calcularValorTotalEvento`, `calcularPercentualReembolso`, `MockPaymentProvider`). O hold de 15 minutos é garantido por um índice único parcial no Postgres (mais amplo que o da Fundação) combinado com expiração preguiçosa (lazy expiry) checada antes de qualquer leitura ou escrita de disponibilidade.

**Tech Stack:** Next.js Route Handlers · Prisma · React (client component) · Vitest + Testing Library · Playwright (E2E)

## Pré-requisitos

Este plano assume que `2026-08-04-fundacao-tecnica.md` e `2026-08-04-reserva-mesa-diaria.md` já foram executados e verificados.

## Global Constraints

Herda todas as constraints dos planos anteriores. Adicionalmente:
- Duração do hold de reserva de evento: **15 minutos** (`DURACAO_HOLD_MINUTOS`), a partir do PDF de pacotes e da conversa de design — não inventar outro valor.
- Limite para exigir ciência do Art. 49 do CDC: eventos com **menos de 7 dias** entre o pagamento e a data do evento.
- Tabela de reembolso é sempre lida do banco (`PoliticaCancelamento`, seedada na Fundação), nunca hardcoded na rota — é isso que a torna configurável pelo admin sem deploy.
- Cardápio Aberto **nunca** passa pela rota de checkout automático (`POST /api/eventos/reservas`) — só pela rota de pedido de orçamento (`POST /api/eventos/orcamento`), que não bloqueia data nenhuma no calendário.

## Visão geral dos arquivos

```
prisma/
  schema.prisma                                        (modificado)
src/
  lib/
    domain/
      cancellationPolicyRepository.ts                  (novo)
      eventHolds.ts                                     (novo)
  app/
    api/
      eventos/
        disponibilidade/route.ts                        (novo)
        orcamento/route.ts                               (novo)
        reservas/
          route.ts                                       (novo)
          [id]/
            pagamento/route.ts                           (novo)
            pratos/route.ts                              (novo)
            cancelar/route.ts                            (novo)
    reservar-evento/
      page.tsx                                           (novo)
      ReservaEventoWizard.tsx                             (novo)
src/test-utils/datas.ts                                  (modificado — adiciona daquiADias)
e2e/
  reserva-evento.spec.ts                                 (novo)
```

---

### Task 1: Schema — pedido de orçamento, campos de reembolso e hold mais amplo

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: modelo `PedidoOrcamento`; campos `percentualReembolsoAplicado`, `valorReembolso`, `cienciaDireitoArrependimento` em `ReservaEvento`; índice único parcial `reserva_evento_unica_ativa_por_dia` (substitui o índice mais estreito da Fundação).

- [ ] **Step 1: Adicionar o modelo e os campos ao schema**

Acrescente ao `prisma/schema.prisma` (ao final):
```prisma
model PedidoOrcamento {
  id              String     @id @default(cuid())
  clienteNome     String
  clienteTelefone String
  clienteEmail    String
  tipoEvento      TipoEvento
  dataDesejada    DateTime   @db.Date
  numConvidados   Int
  observacoes     String?
  createdAt       DateTime   @default(now())
}
```

E modifique o modelo `ReservaEvento` (já existente), adicionando estes três campos dentro dele:
```prisma
  percentualReembolsoAplicado Decimal? @db.Decimal(5, 2)
  valorReembolso               Decimal? @db.Decimal(10, 2)
  cienciaDireitoArrependimento Boolean  @default(false)
```

- [ ] **Step 2: Gerar a migração sem aplicar**

Run: `docker compose up -d db`
Run: `npx prisma migrate dev --name add_pedido_orcamento_e_reembolso --create-only`

- [ ] **Step 3: Substituir o índice único parcial de evento no arquivo de migração gerado**

Abra `prisma/migrations/<timestamp>_add_pedido_orcamento_e_reembolso/migration.sql` e acrescente ao final:

```sql
-- Substitui o índice da Fundação (que só cobria CONFIRMADA) por um mais amplo:
-- no máximo UMA reserva "ativa" (aguardando pagamento OU confirmada) por dia.
-- Isso é o que garante o hold de 15 minutos contra dupla reserva no nível do banco.
DROP INDEX IF EXISTS "reserva_evento_unica_confirmada_por_dia";

CREATE UNIQUE INDEX "reserva_evento_unica_ativa_por_dia"
ON "ReservaEvento" ("data")
WHERE "status" IN ('AGUARDANDO_PAGAMENTO', 'CONFIRMADA');
```

- [ ] **Step 4: Aplicar a migração**

Run: `npx prisma migrate dev`
Expected: migração aplicada sem erro.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: schema de pedido de orçamento, reembolso e hold amplo de evento"
```

---

### Task 2: Domain — leitura da política de cancelamento configurável

**Files:**
- Create: `src/lib/domain/cancellationPolicyRepository.ts`
- Test: `src/lib/domain/cancellationPolicyRepository.test.ts`

**Interfaces:**
- Consumes: `prisma.politicaCancelamento` (Fundação), tipo `PoliticaCancelamentoTier` (Fundação, `src/lib/domain/refundPolicy.ts`).
- Produces: `buscarTiersPoliticaCancelamento()`.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/domain/cancellationPolicyRepository.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buscarTiersPoliticaCancelamento } from "./cancellationPolicyRepository";

describe("buscarTiersPoliticaCancelamento", () => {
  let tierId: string;

  beforeAll(async () => {
    const tier = await prisma.politicaCancelamento.create({
      data: { diasMinimos: 9999, diasMaximos: null, percentualReembolso: 42 },
    });
    tierId = tier.id;
  });

  afterAll(async () => {
    await prisma.politicaCancelamento.delete({ where: { id: tierId } });
  });

  it("inclui o tier inserido, convertendo Decimal para number", async () => {
    const tiers = await buscarTiersPoliticaCancelamento();
    const tierInserido = tiers.find((t) => t.diasMinimos === 9999);
    expect(tierInserido).toEqual({ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 42 });
  });
});
```

**Por que o teste usa `diasMinimos: 9999` em vez de checar os tiers seedados:** essa tabela é configuração global compartilhada por todo o app — testar contra os valores exatos do seed acoplaria este teste ao conteúdo do seed (que o admin pode legitimamente mudar depois). Um valor-sentinela isolado testa a função sem interferir nem depender dos dados reais.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- cancellationPolicyRepository`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/cancellationPolicyRepository.ts`:
```ts
import { prisma } from "@/lib/db";
import type { PoliticaCancelamentoTier } from "./refundPolicy";

export async function buscarTiersPoliticaCancelamento(): Promise<PoliticaCancelamentoTier[]> {
  const registros = await prisma.politicaCancelamento.findMany({
    orderBy: { diasMinimos: "desc" },
  });

  return registros.map((registro) => ({
    diasMinimos: registro.diasMinimos,
    diasMaximos: registro.diasMaximos,
    percentualReembolso: Number(registro.percentualReembolso),
  }));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- cancellationPolicyRepository`
Expected: PASS (1 teste)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/cancellationPolicyRepository.ts src/lib/domain/cancellationPolicyRepository.test.ts
git commit -m "feat: leitura da política de cancelamento configurável do banco"
```

---

### Task 3: Domain — hold de evento e verificação de disponibilidade

**Files:**
- Create: `src/lib/domain/eventHolds.ts`
- Test: `src/lib/domain/eventHolds.test.ts`

**Interfaces:**
- Produces: `liberarHoldsExpirados()`, `dataDisponivelParaEvento(data)`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/domain/eventHolds.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { dataDisponivelParaEvento } from "./eventHolds";

describe("dataDisponivelParaEvento", () => {
  const data = new Date(2027, 8, 10);

  afterEach(async () => {
    await prisma.reservaEvento.deleteMany({ where: { data } });
  });

  it("retorna true quando não há reserva para a data", async () => {
    expect(await dataDisponivelParaEvento(data)).toBe(true);
  });

  it("retorna false quando existe reserva CONFIRMADA na data", async () => {
    await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        valorTotal: 1000,
        status: "CONFIRMADA",
      },
    });

    expect(await dataDisponivelParaEvento(data)).toBe(false);
  });

  it("retorna false quando existe hold válido (AGUARDANDO_PAGAMENTO não expirado)", async () => {
    await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        valorTotal: 1000,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(await dataDisponivelParaEvento(data)).toBe(false);
  });

  it("libera e retorna true quando o hold já expirou", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        valorTotal: 1000,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    expect(await dataDisponivelParaEvento(data)).toBe(true);

    const atualizada = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(atualizada?.status).toBe("CANCELADA");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventHolds`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/eventHolds.ts`:
```ts
import { prisma } from "@/lib/db";

export async function liberarHoldsExpirados(): Promise<void> {
  await prisma.reservaEvento.updateMany({
    where: {
      status: "AGUARDANDO_PAGAMENTO",
      holdExpiresAt: { lt: new Date() },
    },
    data: { status: "CANCELADA" },
  });
}

export async function dataDisponivelParaEvento(data: Date): Promise<boolean> {
  await liberarHoldsExpirados();

  const reservaAtiva = await prisma.reservaEvento.findFirst({
    where: {
      data,
      status: { in: ["AGUARDANDO_PAGAMENTO", "CONFIRMADA"] },
    },
  });

  return reservaAtiva === null;
}
```

**Nota sobre concorrência residual:** a checagem acima (buscar, depois decidir) tem uma janela teórica entre a leitura e a escrita — se dois clientes conseguissem submeter no exato mesmo milissegundo, ambos poderiam passar nessa checagem. O índice único parcial criado no Task 1 é a trava real: mesmo que dois `POST /api/eventos/reservas` (Task 6) cheguem simultaneamente e ambos passem por `dataDisponivelParaEvento`, só um `INSERT` no banco vai suceder — o outro recebe erro de violação de unicidade, tratado como `409` na rota. Esta função existe para dar uma mensagem de erro amigável antecipada na maioria dos casos reais, não para ser a única linha de defesa.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventHolds`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/eventHolds.ts src/lib/domain/eventHolds.test.ts
git commit -m "feat: hold de evento com expiração preguiçosa e verificação de disponibilidade"
```

---

### Task 4: API — GET /api/eventos/disponibilidade

**Files:**
- Create: `src/app/api/eventos/disponibilidade/route.ts`
- Test: `src/app/api/eventos/disponibilidade/route.test.ts`

**Interfaces:**
- Consumes: `dataDisponivelParaEvento` (Task 3), `proximaTercaFeiraDistante` (plano anterior, `src/test-utils/datas.ts`).
- Produces: `GET /api/eventos/disponibilidade?data=YYYY-MM-DD` → `{ disponivel: boolean }`.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/eventos/disponibilidade/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("GET /api/eventos/disponibilidade", () => {
  it("retorna 400 quando o parâmetro data está ausente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/disponibilidade");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna disponivel=true para uma data futura sem reserva", async () => {
    const data = proximaTercaFeiraDistante();
    const request = new NextRequest(`http://localhost/api/eventos/disponibilidade?data=${data}`);
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.disponivel).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventos/disponibilidade`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/eventos/disponibilidade/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { dataDisponivelParaEvento } from "@/lib/domain/eventHolds";

export async function GET(request: NextRequest) {
  const dataParam = request.nextUrl.searchParams.get("data");

  if (!dataParam) {
    return NextResponse.json({ erro: "parâmetro 'data' é obrigatório" }, { status: 400 });
  }

  const data = new Date(`${dataParam}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const disponivel = await dataDisponivelParaEvento(data);
  return NextResponse.json({ disponivel });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventos/disponibilidade`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/disponibilidade/
git commit -m "feat: rota de disponibilidade de data para evento"
```

---

### Task 5: API — POST /api/eventos/orcamento (Cardápio Aberto)

**Files:**
- Create: `src/app/api/eventos/orcamento/route.ts`
- Test: `src/app/api/eventos/orcamento/route.test.ts`

**Interfaces:**
- Produces: `POST /api/eventos/orcamento` → `201` com o `PedidoOrcamento` criado. Não toca em `ReservaEvento`, não bloqueia data nenhuma.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/eventos/orcamento/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";

describe("POST /api/eventos/orcamento", () => {
  it("cria o pedido de orçamento com dados válidos", async () => {
    const request = new NextRequest("http://localhost/api/eventos/orcamento", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Cliente Cardápio Aberto",
        clienteTelefone: "+5541999999999",
        clienteEmail: "cliente@exemplo.com",
        tipoEvento: "CORPORATIVO",
        dataDesejada: "2027-10-20",
        numConvidados: 25,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.pedido.clienteNome).toBe("Cliente Cardápio Aberto");

    await prisma.pedidoOrcamento.delete({ where: { id: body.pedido.id } });
  });

  it("retorna 400 com dados incompletos", async () => {
    const request = new NextRequest("http://localhost/api/eventos/orcamento", {
      method: "POST",
      body: JSON.stringify({ clienteNome: "Só o nome" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventos/orcamento`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/eventos/orcamento/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PedidoOrcamentoInput {
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  tipoEvento: "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
  dataDesejada: string;
  numConvidados: number;
  observacoes?: string;
}

const TIPOS_EVENTO_VALIDOS = ["CORPORATIVO", "ANIVERSARIO", "JANTAR_RESERVADO", "OUTRO"];

function validarInput(body: unknown): body is PedidoOrcamentoInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.clienteNome === "string" &&
    b.clienteNome.trim().length > 0 &&
    typeof b.clienteTelefone === "string" &&
    b.clienteTelefone.trim().length > 0 &&
    typeof b.clienteEmail === "string" &&
    b.clienteEmail.trim().length > 0 &&
    typeof b.tipoEvento === "string" &&
    TIPOS_EVENTO_VALIDOS.includes(b.tipoEvento) &&
    typeof b.dataDesejada === "string" &&
    typeof b.numConvidados === "number" &&
    b.numConvidados > 0
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados do pedido de orçamento inválidos ou incompletos" }, { status: 400 });
  }

  const dataDesejada = new Date(`${body.dataDesejada}T00:00:00`);
  if (Number.isNaN(dataDesejada.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'dataDesejada' inválido" }, { status: 400 });
  }

  const pedido = await prisma.pedidoOrcamento.create({
    data: {
      clienteNome: body.clienteNome.trim(),
      clienteTelefone: body.clienteTelefone.trim(),
      clienteEmail: body.clienteEmail.trim(),
      tipoEvento: body.tipoEvento,
      dataDesejada,
      numConvidados: body.numConvidados,
      observacoes: body.observacoes?.trim(),
    },
  });

  return NextResponse.json({ pedido }, { status: 201 });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventos/orcamento`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/orcamento/
git commit -m "feat: rota de pedido de orçamento para Cardápio Aberto"
```

---

### Task 6: API — POST /api/eventos/reservas (criar hold)

**Files:**
- Create: `src/app/api/eventos/reservas/route.ts`
- Test: `src/app/api/eventos/reservas/route.test.ts`

**Interfaces:**
- Consumes: `calcularValorTotalEvento` (Fundação), `dataDisponivelParaEvento` (Task 3), `proximaTercaFeiraDistante` (plano anterior).
- Produces: `POST /api/eventos/reservas` → `201` com a reserva em `AGUARDANDO_PAGAMENTO` e `holdExpiresAt` 15 minutos à frente; `409` se a data já estiver ocupada.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/eventos/reservas/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("POST /api/eventos/reservas", () => {
  let pacoteId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Reserva Evento", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("cria o hold com valor calculado corretamente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Empresa Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "contato@empresateste.com",
        tipoEvento: "CORPORATIVO",
        data,
        numConvidados: 10,
        pacoteId,
        equipamentoTelao: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reserva.valorTotal).toBe("2200");
    expect(body.reserva.status).toBe("AGUARDANDO_PAGAMENTO");
  });

  it("retorna 409 ao tentar reservar a mesma data de novo enquanto o hold está ativo", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Outra Empresa",
        clienteTelefone: "+5541988888888",
        clienteEmail: "outra@empresa.com",
        tipoEvento: "CORPORATIVO",
        data,
        numConvidados: 5,
        pacoteId,
        equipamentoTelao: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- eventos/reservas`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/eventos/reservas/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calcularValorTotalEvento } from "@/lib/domain/eventPricing";
import { dataDisponivelParaEvento } from "@/lib/domain/eventHolds";

const DURACAO_HOLD_MINUTOS = 15;
const TIPOS_EVENTO_VALIDOS = ["CORPORATIVO", "ANIVERSARIO", "JANTAR_RESERVADO", "OUTRO"];

interface CriarReservaEventoInput {
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  tipoEvento: "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
  data: string;
  numConvidados: number;
  pacoteId: string;
  equipamentoTelao: boolean;
}

function validarInput(body: unknown): body is CriarReservaEventoInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.clienteNome === "string" &&
    b.clienteNome.trim().length > 0 &&
    typeof b.clienteTelefone === "string" &&
    b.clienteTelefone.trim().length > 0 &&
    typeof b.clienteEmail === "string" &&
    b.clienteEmail.trim().length > 0 &&
    typeof b.tipoEvento === "string" &&
    TIPOS_EVENTO_VALIDOS.includes(b.tipoEvento) &&
    typeof b.data === "string" &&
    typeof b.numConvidados === "number" &&
    b.numConvidados > 0 &&
    b.numConvidados <= 40 &&
    typeof b.pacoteId === "string" &&
    b.pacoteId.length > 0 &&
    typeof b.equipamentoTelao === "boolean"
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados da reserva de evento inválidos ou incompletos" }, { status: 400 });
  }

  const data = new Date(`${body.data}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const pacote = await prisma.pacote.findUnique({ where: { id: body.pacoteId } });
  if (!pacote || pacote.precoPessoa === null) {
    return NextResponse.json(
      {
        erro:
          "pacote inválido — pacotes sem preço fixo (Cardápio Aberto) não passam por checkout automático, use /api/eventos/orcamento",
      },
      { status: 400 }
    );
  }

  const disponivel = await dataDisponivelParaEvento(data);
  if (!disponivel) {
    return NextResponse.json(
      { erro: "essa data já está reservada ou aguardando pagamento de outro cliente" },
      { status: 409 }
    );
  }

  const valorTotal = calcularValorTotalEvento({
    precoPessoa: Number(pacote.precoPessoa),
    numConvidados: body.numConvidados,
    taxaServicoPct: Number(pacote.taxaServicoPct),
    equipamentoTelao: body.equipamentoTelao,
  });

  try {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: body.clienteNome.trim(),
        clienteTelefone: body.clienteTelefone.trim(),
        clienteEmail: body.clienteEmail.trim(),
        tipoEvento: body.tipoEvento,
        data,
        numConvidados: body.numConvidados,
        pacoteId: body.pacoteId,
        equipamentoTelao: body.equipamentoTelao,
        valorTotal,
        percentualSinal: 100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + DURACAO_HOLD_MINUTOS * 60 * 1000),
      },
    });

    return NextResponse.json({ reserva }, { status: 201 });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return NextResponse.json(
        { erro: "essa data acabou de ser reservada por outro cliente, escolha outra" },
        { status: 409 }
      );
    }
    throw erro;
  }
}
```

**Nota de extensibilidade:** `percentualSinal` fica fixo em `100` nesta rota — o caso de sinal negociado por telefone com percentual customizado é responsabilidade do Painel Admin (próximo plano), que vai gerar reservas com percentual diferente reaproveitando a mesma tabela e o mesmo fluxo de pagamento (Task 7), só criando o registro por um caminho diferente (admin autenticado, não checkout público).

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- eventos/reservas`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/reservas/route.ts src/app/api/eventos/reservas/route.test.ts
git commit -m "feat: rota de criação de hold de reserva de evento com cálculo de valor"
```

---

### Task 7: Utilitário de teste — data próxima e API de pagamento

**Files:**
- Modify: `src/test-utils/datas.ts`
- Create: `src/app/api/eventos/reservas/[id]/pagamento/route.ts`
- Test: `src/app/api/eventos/reservas/[id]/pagamento/route.test.ts`

**Interfaces:**
- Consumes: `MockPaymentProvider` (Fundação), `PaymentProvider`/`MetodoPagamento` (Fundação).
- Produces: `daquiADias(dias)` (utilitário), `POST /api/eventos/reservas/[id]/pagamento` → `200` confirmando a reserva, `410` se o hold expirou, `400` se faltar ciência do Art. 49 CDC em evento de última hora.

- [ ] **Step 1: Adicionar o utilitário de data próxima**

Acrescente a `src/test-utils/datas.ts`:
```ts
export function daquiADias(dias: number): Date {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + dias);
  return data;
}
```

- [ ] **Step 2: Escrever os testes que falham**

`src/app/api/eventos/reservas/[id]/pagamento/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("POST /api/eventos/reservas/[id]/pagamento", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Pagamento", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEvento: { pacoteId } } });
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  async function criarHold(data: Date, holdExpiresAt: Date) {
    return prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        percentualSinal: 100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt,
      },
    });
  }

  it("confirma o pagamento e a reserva quando o hold está válido e a data é distante", async () => {
    const reserva = await criarHold(daquiADias(30), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: { id: reserva.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CONFIRMADA");
    expect(body.pagamento.status).toBe("APROVADO");
  });

  it("retorna 410 quando o hold já expirou", async () => {
    const reserva = await criarHold(daquiADias(30), new Date(Date.now() - 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: { id: reserva.id } });
    expect(response.status).toBe(410);
  });

  it("exige ciência do direito de arrependimento para evento com menos de 7 dias", async () => {
    const reserva = await criarHold(daquiADias(3), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: { id: reserva.id } });
    expect(response.status).toBe(400);
  });

  it("aceita o pagamento com menos de 7 dias quando a ciência é confirmada", async () => {
    const reserva = await criarHold(daquiADias(3), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix", cienciaDireitoArrependimento: true }),
    });

    const response = await POST(request, { params: { id: reserva.id } });
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm test -- pagamento`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar**

`src/app/api/eventos/reservas/[id]/pagamento/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MockPaymentProvider } from "@/providers/payment/MockPaymentProvider";
import type { MetodoPagamento } from "@/providers/payment/PaymentProvider";

const DIAS_LIMITE_DIREITO_ARREPENDIMENTO = 7;

interface PagamentoInput {
  metodo: MetodoPagamento;
  cienciaDireitoArrependimento?: boolean;
}

function validarInput(body: unknown): body is PagamentoInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return b.metodo === "pix" || b.metodo === "cartao";
}

function diasAteEvento(dataEvento: Date, agora: Date): number {
  const diffMs = dataEvento.getTime() - agora.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "método de pagamento inválido" }, { status: 400 });
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id: params.id } });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    return NextResponse.json({ erro: "essa reserva não está aguardando pagamento" }, { status: 409 });
  }

  if (reserva.holdExpiresAt && reserva.holdExpiresAt < new Date()) {
    await prisma.reservaEvento.update({ where: { id: reserva.id }, data: { status: "CANCELADA" } });
    return NextResponse.json(
      { erro: "o tempo para concluir o pagamento expirou, comece a reserva novamente" },
      { status: 410 }
    );
  }

  const dias = diasAteEvento(reserva.data, new Date());
  if (dias < DIAS_LIMITE_DIREITO_ARREPENDIMENTO && !body.cienciaDireitoArrependimento) {
    return NextResponse.json(
      {
        erro:
          "para eventos com menos de 7 dias de antecedência, é necessário confirmar ciência sobre o direito de arrependimento (Art. 49 do CDC)",
      },
      { status: 400 }
    );
  }

  const valorSinal =
    Math.round(Number(reserva.valorTotal) * (Number(reserva.percentualSinal) / 100) * 100) / 100;

  const provider = new MockPaymentProvider();
  const resultadoPagamento = await provider.iniciarPagamento({
    reservaEventoId: reserva.id,
    valor: valorSinal,
    metodo: body.metodo,
  });

  const [pagamento, reservaAtualizada] = await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: resultadoPagamento.provedor,
        metodo: body.metodo === "pix" ? "PIX" : "CARTAO",
        valor: valorSinal,
        status: resultadoPagamento.status === "aprovado" ? "APROVADO" : "RECUSADO",
      },
    }),
    prisma.reservaEvento.update({
      where: { id: reserva.id },
      data: {
        status: resultadoPagamento.status === "aprovado" ? "CONFIRMADA" : "CANCELADA",
        holdExpiresAt: null,
        cienciaDireitoArrependimento: Boolean(body.cienciaDireitoArrependimento),
      },
    }),
  ]);

  return NextResponse.json({ pagamento, reserva: reservaAtualizada }, { status: 200 });
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- pagamento`
Expected: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add src/test-utils/datas.ts src/app/api/eventos/reservas/\[id\]/pagamento/
git commit -m "feat: rota de pagamento do evento com checagem de hold e ciência do CDC"
```

---

### Task 8: API — PUT /api/eventos/reservas/[id]/pratos

**Files:**
- Create: `src/app/api/eventos/reservas/[id]/pratos/route.ts`
- Test: `src/app/api/eventos/reservas/[id]/pratos/route.test.ts`

**Interfaces:**
- Produces: `PUT /api/eventos/reservas/[id]/pratos` → `200` gravando `pratosEscolhidos`; `409` se a reserva não estiver `CONFIRMADA`; `400` se a contagem de pratos estiver errada.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/eventos/reservas/[id]/pratos/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PUT } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("PUT /api/eventos/reservas/[id]/pratos", () => {
  let pacoteId: string;
  let reservaConfirmadaId: string;
  let reservaPendenteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Pratos", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    const confirmada = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Confirmado",
        clienteTelefone: "+5541999999999",
        clienteEmail: "confirmado@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status: "CONFIRMADA",
      },
    });
    reservaConfirmadaId = confirmada.id;

    const pendente = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Pendente",
        clienteTelefone: "+5541999999998",
        clienteEmail: "pendente@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(21),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 60000),
      },
    });
    reservaPendenteId = pendente.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("grava os pratos escolhidos numa reserva confirmada", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaConfirmadaId}/pratos`, {
      method: "PUT",
      body: JSON.stringify({
        entradas: ["Arancini", "Fritte Al Tartufo", "Caesar"],
        principais: ["Gnocchi Al Ragu", "Funghi e Filetto", "Cappelletti", "Gnocchi Grelhado"],
        sobremesa: "Tiramisu",
      }),
    });

    const response = await PUT(request, { params: { id: reservaConfirmadaId } });
    expect(response.status).toBe(200);
  });

  it("retorna 400 quando a contagem de pratos está errada", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaConfirmadaId}/pratos`, {
      method: "PUT",
      body: JSON.stringify({ entradas: ["Arancini"], principais: [], sobremesa: "Tiramisu" }),
    });

    const response = await PUT(request, { params: { id: reservaConfirmadaId } });
    expect(response.status).toBe(400);
  });

  it("retorna 409 quando a reserva ainda não está confirmada", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaPendenteId}/pratos`, {
      method: "PUT",
      body: JSON.stringify({
        entradas: ["Arancini", "Fritte Al Tartufo", "Caesar"],
        principais: ["Gnocchi Al Ragu", "Funghi e Filetto", "Cappelletti", "Gnocchi Grelhado"],
        sobremesa: "Tiramisu",
      }),
    });

    const response = await PUT(request, { params: { id: reservaPendenteId } });
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- pratos`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/eventos/reservas/[id]/pratos/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PratosInput {
  entradas: string[];
  principais: string[];
  sobremesa: string;
}

function validarInput(body: unknown): body is PratosInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.entradas) &&
    b.entradas.length === 3 &&
    b.entradas.every((e) => typeof e === "string") &&
    Array.isArray(b.principais) &&
    b.principais.length === 4 &&
    b.principais.every((p) => typeof p === "string") &&
    typeof b.sobremesa === "string" &&
    b.sobremesa.length > 0
  );
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json(
      { erro: "é necessário escolher exatamente 3 entradas, 4 pratos principais e 1 sobremesa" },
      { status: 400 }
    );
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id: params.id } });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "CONFIRMADA") {
    return NextResponse.json(
      { erro: "só é possível escolher os pratos de uma reserva confirmada" },
      { status: 409 }
    );
  }

  const atualizada = await prisma.reservaEvento.update({
    where: { id: params.id },
    data: { pratosEscolhidos: body },
  });

  return NextResponse.json({ reserva: atualizada });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- pratos`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/reservas/\[id\]/pratos/
git commit -m "feat: rota de escolha dos pratos pós-pagamento"
```

---

### Task 9: API — POST /api/eventos/reservas/[id]/cancelar

**Files:**
- Create: `src/app/api/eventos/reservas/[id]/cancelar/route.ts`
- Test: `src/app/api/eventos/reservas/[id]/cancelar/route.test.ts`

**Interfaces:**
- Consumes: `calcularPercentualReembolso` (Fundação), `buscarTiersPoliticaCancelamento` (Task 2).
- Produces: `POST /api/eventos/reservas/[id]/cancelar` → `200` com a reserva `CANCELADA` e os campos de reembolso preenchidos.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/eventos/reservas/[id]/cancelar/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("POST /api/eventos/reservas/[id]/cancelar", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Cancelamento", precoPessoa: 100, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("calcula e aplica o reembolso de 100% para cancelamento com 20 dias de antecedência", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "CONFIRMADA",
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });

    const response = await POST(request, { params: { id: reserva.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CANCELADA");
    expect(body.reserva.percentualReembolsoAplicado).toBe("100");
    expect(body.reserva.valorReembolso).toBe("1100");
  });

  it("retorna 409 ao tentar cancelar uma reserva que não está confirmada", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste 2",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste2@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 60000),
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });

    const response = await POST(request, { params: { id: reserva.id } });
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- cancelar`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/eventos/reservas/[id]/cancelar/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularPercentualReembolso } from "@/lib/domain/refundPolicy";
import { buscarTiersPoliticaCancelamento } from "@/lib/domain/cancellationPolicyRepository";

function diasEntre(dataEvento: Date, agora: Date): number {
  const diffMs = dataEvento.getTime() - agora.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const reserva = await prisma.reservaEvento.findUnique({ where: { id: params.id } });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "CONFIRMADA") {
    return NextResponse.json({ erro: "só é possível cancelar uma reserva confirmada" }, { status: 409 });
  }

  const tiers = await buscarTiersPoliticaCancelamento();
  const dias = diasEntre(reserva.data, new Date());
  const percentualReembolso = calcularPercentualReembolso(dias, tiers);
  const valorReembolso = Math.round(Number(reserva.valorTotal) * (percentualReembolso / 100) * 100) / 100;

  const atualizada = await prisma.reservaEvento.update({
    where: { id: params.id },
    data: {
      status: "CANCELADA",
      percentualReembolsoAplicado: percentualReembolso,
      valorReembolso,
    },
  });

  return NextResponse.json({ reserva: atualizada });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- cancelar`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/reservas/\[id\]/cancelar/
git commit -m "feat: rota de cancelamento de evento com cálculo de reembolso configurável"
```

---

### Task 10: UI — página e assistente de reserva de evento

**Files:**
- Create: `src/app/reservar-evento/page.tsx`
- Create: `src/app/reservar-evento/ReservaEventoWizard.tsx`
- Test: `src/app/reservar-evento/ReservaEventoWizard.test.tsx`

**Interfaces:**
- Consumes: rotas `/api/eventos/disponibilidade`, `/api/eventos/orcamento`, `/api/eventos/reservas`, `/api/eventos/reservas/[id]/pagamento`.

- [ ] **Step 1: Escrever o teste de componente que falha**

`src/app/reservar-evento/ReservaEventoWizard.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaEventoWizard } from "./ReservaEventoWizard";

describe("ReservaEventoWizard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/eventos/disponibilidade")) {
          return new Response(JSON.stringify({ disponivel: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );
  });

  it("avança para a etapa de pacote quando a data está disponível", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 197 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2027-09-10" } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- ReservaEventoWizard`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o componente**

`src/app/reservar-evento/ReservaEventoWizard.tsx`:
```tsx
"use client";

import { useState } from "react";

interface Pacote {
  id: string;
  nome: string;
  precoPessoa: number | null;
}

interface ReservaEventoWizardProps {
  pacotes: Pacote[];
}

type TipoEvento = "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
type Etapa = "quando" | "pacote" | "orcamento" | "orcamentoEnviado" | "checkout" | "confirmado";

const VALOR_TELAO_PROJETOR = 500;

export function ReservaEventoWizard({ pacotes }: ReservaEventoWizardProps) {
  const [etapa, setEtapa] = useState<Etapa>("quando");
  const [data, setData] = useState("");
  const [tipoEvento, setTipoEvento] = useState<TipoEvento>("ANIVERSARIO");
  const [numConvidados, setNumConvidados] = useState(10);
  const [pacoteId, setPacoteId] = useState("");
  const [cardapioAberto, setCardapioAberto] = useState(false);
  const [equipamentoTelao, setEquipamentoTelao] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [reservaId, setReservaId] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [precisaCienciaCdc, setPrecisaCienciaCdc] = useState(false);
  const [cienciaAceita, setCienciaAceita] = useState(false);
  const [metodo, setMetodo] = useState<"pix" | "cartao">("pix");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function calcularValorEstimado(pacote: Pacote): number {
    if (pacote.precoPessoa === null) return 0;
    const subtotal = pacote.precoPessoa * numConvidados * 1.1;
    return Math.round((subtotal + (equipamentoTelao ? VALOR_TELAO_PROJETOR : 0)) * 100) / 100;
  }

  async function verificarDisponibilidade() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/eventos/disponibilidade?data=${data}`);
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível verificar disponibilidade");
        return;
      }
      if (corpo.disponivel) {
        setEtapa("pacote");
      } else {
        setErro("essa data já está reservada, escolha outra");
      }
    } finally {
      setCarregando(false);
    }
  }

  async function escolherPacote() {
    if (cardapioAberto) {
      setEtapa("orcamento");
      return;
    }

    if (!pacoteId) {
      setErro("escolha um pacote");
      return;
    }

    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/eventos/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNome,
          clienteTelefone,
          clienteEmail,
          tipoEvento,
          data,
          numConvidados,
          pacoteId,
          equipamentoTelao,
        }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível criar a reserva");
        if (resposta.status === 409) {
          setEtapa("quando");
        }
        return;
      }

      setReservaId(corpo.reserva.id);
      setValorTotal(Number(corpo.reserva.valorTotal));

      const dataEvento = new Date(`${data}T00:00:00`);
      const diasAteEvento = Math.floor((dataEvento.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setPrecisaCienciaCdc(diasAteEvento < 7);

      setEtapa("checkout");
    } finally {
      setCarregando(false);
    }
  }

  async function enviarPedidoOrcamento() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/eventos/orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNome,
          clienteTelefone,
          clienteEmail,
          tipoEvento,
          dataDesejada: data,
          numConvidados,
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json();
        setErro(corpo.erro ?? "não foi possível enviar o pedido de orçamento");
        return;
      }

      setEtapa("orcamentoEnviado");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarPagamento() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/eventos/reservas/${reservaId}/pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodo, cienciaDireitoArrependimento: cienciaAceita }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível confirmar o pagamento");
        return;
      }

      setEtapa("confirmado");
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "orcamentoEnviado") {
    return <p role="status">Pedido de orçamento enviado! Nossa equipe entrará em contato em breve.</p>;
  }

  if (etapa === "confirmado") {
    return (
      <p role="status">
        Evento confirmado para {clienteNome} em {data}. Em breve você recebe o link para escolher os pratos do
        cardápio.
      </p>
    );
  }

  return (
    <div>
      {erro && <p role="alert">{erro}</p>}

      {etapa === "quando" && (
        <fieldset>
          <legend>Sobre o seu evento</legend>
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Tipo de evento
            <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value as TipoEvento)}>
              <option value="CORPORATIVO">Corporativo</option>
              <option value="ANIVERSARIO">Aniversário</option>
              <option value="JANTAR_RESERVADO">Jantar reservado</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            Número de convidados (até 40)
            <input
              type="number"
              min={1}
              max={40}
              value={numConvidados}
              onChange={(e) => setNumConvidados(Number(e.target.value))}
            />
          </label>
          <label>
            Nome
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          </label>
          <label>
            Telefone
            <input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} />
          </label>
          <label>
            E-mail
            <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
          </label>
          <button
            type="button"
            onClick={verificarDisponibilidade}
            disabled={
              !data || !clienteNome.trim() || !clienteTelefone.trim() || !clienteEmail.trim() || carregando
            }
          >
            Verificar disponibilidade
          </button>
        </fieldset>
      )}

      {etapa === "pacote" && (
        <fieldset>
          <legend>Escolha o pacote</legend>
          {pacotes.map((pacote) => (
            <label key={pacote.id}>
              <input
                type="radio"
                name="pacote"
                checked={!cardapioAberto && pacoteId === pacote.id}
                onChange={() => {
                  setCardapioAberto(pacote.precoPessoa === null);
                  setPacoteId(pacote.id);
                }}
              />
              {pacote.nome}
              {pacote.precoPessoa !== null
                ? ` — R$ ${pacote.precoPessoa.toFixed(2)}/pessoa (estimado: R$ ${calcularValorEstimado(pacote).toFixed(2)})`
                : " — orçamento sob consulta"}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={equipamentoTelao}
              onChange={(e) => setEquipamentoTelao(e.target.checked)}
            />
            Telão &amp; Projetor (+R$ 500,00)
          </label>
          <button type="button" onClick={escolherPacote} disabled={!pacoteId || carregando}>
            {cardapioAberto ? "Solicitar orçamento" : "Continuar para pagamento"}
          </button>
        </fieldset>
      )}

      {etapa === "orcamento" && (
        <fieldset>
          <legend>Pedido de orçamento — Cardápio Aberto</legend>
          <p>Sua data, tipo de evento e número de convidados já foram registrados. Confirme o envio:</p>
          <button type="button" onClick={enviarPedidoOrcamento} disabled={carregando}>
            Enviar pedido de orçamento
          </button>
        </fieldset>
      )}

      {etapa === "checkout" && (
        <fieldset>
          <legend>Pagamento</legend>
          <p>Valor total: R$ {valorTotal.toFixed(2)}</p>
          <label>
            <input type="radio" name="metodo" checked={metodo === "pix"} onChange={() => setMetodo("pix")} />
            Pix
          </label>
          <label>
            <input
              type="radio"
              name="metodo"
              checked={metodo === "cartao"}
              onChange={() => setMetodo("cartao")}
            />
            Cartão de crédito
          </label>

          {precisaCienciaCdc && (
            <label>
              <input
                type="checkbox"
                checked={cienciaAceita}
                onChange={(e) => setCienciaAceita(e.target.checked)}
              />
              Estou ciente de que, ao reservar um evento com menos de 7 dias de antecedência, solicito a
              execução imediata do serviço; após a realização do evento, o direito de arrependimento (Art. 49
              do CDC) não se aplica.
            </label>
          )}

          <button
            type="button"
            onClick={confirmarPagamento}
            disabled={(precisaCienciaCdc && !cienciaAceita) || carregando}
          >
            Confirmar pagamento
          </button>
        </fieldset>
      )}
    </div>
  );
}
```

`src/app/reservar-evento/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { ReservaEventoWizard } from "./ReservaEventoWizard";

export default async function ReservarEventoPage() {
  const pacotes = await prisma.pacote.findMany({ orderBy: { nome: "asc" } });

  return (
    <main>
      <h1>Reservar Evento</h1>
      <ReservaEventoWizard
        pacotes={pacotes.map((p) => ({
          id: p.id,
          nome: p.nome,
          precoPessoa: p.precoPessoa === null ? null : Number(p.precoPessoa),
        }))}
      />
    </main>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- ReservaEventoWizard`
Expected: PASS (1 teste)

- [ ] **Step 5: Verificação manual no navegador**

Run: `docker compose up -d --build`
Acesse `http://localhost:3000/reservar-evento` e percorra os dois caminhos manualmente: pacote fechado até a confirmação de pagamento, e Cardápio Aberto até o envio do pedido de orçamento.

- [ ] **Step 6: Commit**

```bash
git add src/app/reservar-evento/
git commit -m "feat: página e assistente de reserva de evento no mezanino"
```

---

### Task 11: E2E — fluxo completo de reserva de evento

**Files:**
- Create: `e2e/reserva-evento.spec.ts`

**Interfaces:**
- Consumes: página `/reservar-evento` (Task 10), `prisma` e `proximaTercaFeiraDistante` para preparar e limpar dados de teste.

- [ ] **Step 1: Escrever o teste E2E**

`e2e/reserva-evento.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { proximaTercaFeiraDistante } from "../src/test-utils/datas";

test.describe("Reserva de evento no mezanino", () => {
  let pacoteId: string;
  let dataEvento: string;

  test.beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote E2E", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
    dataEvento = proximaTercaFeiraDistante();
  });

  test.afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEvento: { pacoteId } } });
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  test("cliente reserva um evento e paga o sinal do início ao fim", async ({ page }) => {
    await page.goto("/reservar-evento");

    await page.getByLabel("Data").fill(dataEvento);
    await page.getByLabel("Nome").fill("Empresa E2E");
    await page.getByLabel("Telefone").fill("+5541999998888");
    await page.getByLabel("E-mail").fill("contato@empresae2e.com");
    await page.getByText("Verificar disponibilidade").click();

    await page.getByText("Pacote E2E", { exact: false }).click();
    await page.getByText("Continuar para pagamento").click();

    await page.getByLabel("Pix").check();
    await page.getByText("Confirmar pagamento").click();

    await expect(page.getByRole("status")).toContainText("Evento confirmado");
  });
});
```

- [ ] **Step 2: Rodar o E2E com o stack completo no ar**

Run: `docker compose up -d --build`
Run: `npx prisma migrate dev`
Run: `npm run db:seed`
Run: `npm run test:e2e`
Expected: 2 testes passando (este e o do Plano 2).

- [ ] **Step 3: Commit**

```bash
git add e2e/reserva-evento.spec.ts
git commit -m "test: E2E do fluxo completo de reserva de evento com checkout mock"
```

---

## Checklist final do plano

- [ ] `npm test` passa 100% (Fundação + Plano de Mesa Diária + todas as Tasks deste plano)
- [ ] `npm run test:e2e` passa com o stack Docker no ar (2 fluxos: mesa e evento)
- [ ] Tentar criar dois holds de evento para a mesma data (via `curl` duplicado ou teste manual) devolve `409` no segundo
- [ ] Um evento criado a 3 dias de distância exige o checkbox de ciência do Art. 49 CDC antes de aceitar o pagamento; um evento a 30 dias não exige
- [ ] Cancelar uma reserva `CONFIRMADA` grava `percentualReembolsoAplicado` e `valorReembolso` de acordo com a tabela em `PoliticaCancelamento`
- [ ] Um pedido de Cardápio Aberto nunca aparece na checagem de disponibilidade de data (`PedidoOrcamento` é uma tabela separada, sem efeito sobre `dataDisponivelParaEvento`)

Com isso pronto, o próximo plano (Painel Admin) constrói por cima: confirmação/cancelamento manual, edição de percentual de sinal negociado por telefone, edição da tabela de política de cancelamento, e a visão consolidada do dia para a equipe.
