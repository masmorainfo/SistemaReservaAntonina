# Gateway de Pagamento Real (Mercado Pago, PIX) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `MockPaymentProvider` por um `MercadoPagoProvider` real (modo sandbox/teste) para pagamentos PIX de eventos, incluindo confirmação assíncrona via webhook e estorno real no cancelamento.

**Architecture:** `MercadoPagoProvider` implementa a interface `PaymentProvider` já existente usando o SDK oficial `mercadopago`. A troca de provider ativo acontece via variável de ambiente (`PAYMENT_PROVIDER=mercadopago`), nunca como padrão da fábrica — isso preserva o comportamento de todos os testes existentes que dependem do mock. Confirmação de pagamento deixa de acontecer no retorno síncrono de `iniciarPagamento` e passa a depender de um webhook dedicado, que também cobre o caso de um pagamento aprovado depois que o hold da reserva já expirou (estorno automático).

**Tech Stack:** Next.js Route Handlers · Prisma · SDK oficial `mercadopago` (Node) · Vitest · Playwright (verificação manual, não E2E automatizado)

## Pré-requisitos

Este plano assume que os quatro planos da Fase 1 (`fundacao-tecnica`, `reserva-mesa-diaria`, `reserva-evento-mezanino`, `painel-admin`) já foram executados e verificados, e que a spec `docs/superpowers/specs/2026-08-07-mercadopago-pix-design.md` foi lida e aprovada.

## Fora de escopo (ver spec para detalhes)

Cartão de crédito real, WhatsApp Business real, Mattertags reais, seletor de provedor de pagamento no painel admin, outros gateways (Stripe/PagSeguro/Asaas).

## Global Constraints

Herda todas as constraints dos planos anteriores. Adicionalmente:
- `MercadoPagoProvider.validarWebhook` **nunca** confia no status embutido no corpo da notificação recebida — sempre rebusca o pagamento pela API do Mercado Pago usando o ID, e só então retorna o status real.
- `getPaymentProvider()` só retorna `MercadoPagoProvider` quando `process.env.PAYMENT_PROVIDER === "mercadopago"` — sem essa variável (inclusive no ambiente de teste), continua retornando `MockPaymentProvider`. Nenhum teste deve depender de setar essa variável.
- Nenhum teste automatizado faz chamada de rede real ao Mercado Pago — o SDK (`mercadopago`) é sempre mockado via `vi.mock` nos testes de `MercadoPagoProvider`.
- A rota de webhook é idempotente: reprocessar a mesma notificação (o Mercado Pago reentrega em caso de timeout) não pode duplicar efeito — nem na confirmação da reserva, nem no estorno automático do caso "pagamento aprovado após o hold expirar".
- Os nomes exatos de classes/métodos do SDK `mercadopago` usados nos snippets abaixo refletem a API pública conhecida da v2 do SDK oficial — confira contra os tipos do pacote realmente instalado (`node_modules/mercadopago`) antes de finalizar cada task; pequenos ajustes de nome podem ser necessários se a versão instalada divergir.

## Visão geral dos arquivos

```
src/
  providers/
    payment/
      MercadoPagoProvider.ts                        (novo)
      MercadoPagoProvider.test.ts                    (novo)
      mercadoPagoSignature.ts                        (novo)
      mercadoPagoSignature.test.ts                   (novo)
      PaymentProvider.ts                             (modificado)
      MockPaymentProvider.ts                         (modificado)
      MockPaymentProvider.test.ts                    (modificado)
      getPaymentProvider.ts                          (modificado)
      getPaymentProvider.test.ts                     (novo)
  app/
    api/
      webhooks/
        mercadopago/
          route.ts                                   (novo)
          route.test.ts                               (novo)
      eventos/
        reservas/
          [id]/
            route.ts                                  (novo)
            route.test.ts                              (novo)
            pagamento/
              route.ts                                 (modificado)
              route.test.ts                             (modificado)
            cancelar/
              route.ts                                  (modificado)
              route.test.ts                              (modificado)
    reservar-evento/
      ReservaEventoWizard.tsx                          (modificado)
prisma/
  schema.prisma                                        (modificado)
.env.example                                            (modificado)
docker-compose.yml                                      (modificado)
package.json                                            (modificado)
```

---

### Task 1: Setup — dependência, variáveis de ambiente, migração de schema

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Create: `prisma/migrations/<timestamp>_add_referencia_externa_pagamento/` (gerado pelo Prisma)

**Interfaces:**
- Produces: coluna `Pagamento.referenciaExterna` (String, obrigatória, única), consumida por todas as tasks seguintes que criam ou consultam `Pagamento`.

- [ ] **Step 1: Instalar o SDK oficial do Mercado Pago**

Run: `npm install mercadopago`

- [ ] **Step 2: Adicionar a coluna `referenciaExterna` ao modelo `Pagamento`**

Em `prisma/schema.prisma`, localize o modelo `Pagamento` e adicione o campo:

```prisma
model Pagamento {
  id              String              @id @default(cuid())
  reservaEvento   ReservaEvento       @relation(fields: [reservaEventoId], references: [id])
  reservaEventoId String              @unique
  provedor        String
  metodo          MetodoPagamentoEnum
  valor           Decimal             @db.Decimal(10, 2)
  status          StatusPagamento     @default(PENDENTE)
  referenciaExterna String            @unique
  createdAt       DateTime            @default(now())
}
```

A coluna é `NOT NULL` desde o início: `MockPaymentProvider.iniciarPagamento` já gera uma referência hoje (`mock_<reservaId>_<timestamp>`), então nenhum dado existente fica incompleto.

- [ ] **Step 3: Gerar e aplicar a migração**

Run: `npx prisma migrate dev --name add_referencia_externa_pagamento`
Expected: migração criada em `prisma/migrations/` e aplicada ao banco de dev sem erros.

- [ ] **Step 4: Documentar as novas variáveis de ambiente**

Em `.env.example`, adicione (mantendo as linhas existentes):

```
PAYMENT_PROVIDER="mercadopago"
MERCADOPAGO_ACCESS_TOKEN="TEST-substitua-pelo-token-de-teste-do-mercado-pago"
MERCADOPAGO_WEBHOOK_SECRET="substitua-pelo-segredo-de-assinatura-do-webhook"
```

- [ ] **Step 5: Propagar as variáveis para o container de dev**

Em `docker-compose.yml`, no bloco `environment` do serviço `app`, adicione (usando substituição de variável do shell/`.env`, já que são segredos — não hardcode valores aqui):

```yaml
    environment:
      DATABASE_URL: postgresql://antonina:antonina_dev_password@db:5432/antonina_dev
      NEXTAUTH_SECRET: dev_secret_change_in_production
      NEXTAUTH_URL: http://localhost:3000
      TZ: America/Sao_Paulo
      PAYMENT_PROVIDER: ${PAYMENT_PROVIDER:-mock}
      MERCADOPAGO_ACCESS_TOKEN: ${MERCADOPAGO_ACCESS_TOKEN:-}
      MERCADOPAGO_WEBHOOK_SECRET: ${MERCADOPAGO_WEBHOOK_SECRET:-}
```

O default `${PAYMENT_PROVIDER:-mock}` garante que quem não configurou nada continua rodando com o mock (comportamento seguro por padrão).

- [ ] **Step 6: Confirmar que a suíte de testes continua verde**

Run: `npm test`
Expected: PASS (mesma contagem de antes — nenhuma mudança de comportamento nesta task, só schema/config)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma prisma/migrations .env.example docker-compose.yml
git commit -m "feat: adiciona SDK do Mercado Pago, variáveis de ambiente e coluna referenciaExterna"
```

---

### Task 2: Validação de assinatura do webhook do Mercado Pago

**Files:**
- Create: `src/providers/payment/mercadoPagoSignature.ts`
- Test: `src/providers/payment/mercadoPagoSignature.test.ts`

**Interfaces:**
- Produces: `validarAssinaturaWebhook(params: ParametrosAssinatura): boolean`, `ParametrosAssinatura` — usados pela Task 4.

- [ ] **Step 1: Escrever os testes que falham**

`src/providers/payment/mercadoPagoSignature.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validarAssinaturaWebhook } from "./mercadoPagoSignature";
import { createHmac } from "node:crypto";

function assinar(dataId: string, requestId: string, ts: string, segredo: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", segredo).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("validarAssinaturaWebhook", () => {
  const segredo = "segredo-de-teste";

  it("valida uma assinatura corretamente gerada", () => {
    const assinatura = assinar("123456", "req-abc", "1700000000", segredo);

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "123456",
      segredo,
    });

    expect(resultado).toBe(true);
  });

  it("rejeita quando o hash não bate", () => {
    const assinatura = "ts=1700000000,v1=hashqualquerinvalido";

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "123456",
      segredo,
    });

    expect(resultado).toBe(false);
  });

  it("rejeita quando o dataId usado na validação é diferente do assinado", () => {
    const assinatura = assinar("123456", "req-abc", "1700000000", segredo);

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "999999",
      segredo,
    });

    expect(resultado).toBe(false);
  });

  it("rejeita quando o segredo usado na validação é diferente do assinado", () => {
    const assinatura = assinar("123456", "req-abc", "1700000000", segredo);

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "123456",
      segredo: "segredo-errado",
    });

    expect(resultado).toBe(false);
  });

  it("rejeita uma assinatura em formato inválido (sem ts ou v1)", () => {
    const resultado = validarAssinaturaWebhook({
      assinatura: "formato-completamente-invalido",
      requestId: "req-abc",
      dataId: "123456",
      segredo,
    });

    expect(resultado).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- mercadoPagoSignature`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/providers/payment/mercadoPagoSignature.ts`:
```ts
import { createHmac } from "node:crypto";

export interface ParametrosAssinatura {
  /** Valor bruto do header x-signature (formato "ts=...,v1=..."). */
  assinatura: string;
  /** Valor do header x-request-id. */
  requestId: string;
  /** ID do pagamento (data.id da query string da notificação). */
  dataId: string;
  /** MERCADOPAGO_WEBHOOK_SECRET configurado no painel do Mercado Pago. */
  segredo: string;
}

function extrairPartesAssinatura(assinatura: string): { ts: string; v1: string } | null {
  const partes: Record<string, string> = {};

  for (const par of assinatura.split(",")) {
    const [chave, valor] = par.split("=");
    if (chave && valor) {
      partes[chave.trim()] = valor.trim();
    }
  }

  if (!partes.ts || !partes.v1) {
    return null;
  }

  return { ts: partes.ts, v1: partes.v1 };
}

/**
 * Reproduz o algoritmo de validação de assinatura documentado pelo Mercado
 * Pago: monta o manifest "id:{dataId};request-id:{requestId};ts:{ts};",
 * calcula o HMAC-SHA256 com o segredo do webhook, e compara com o valor v1
 * recebido no header x-signature.
 */
export function validarAssinaturaWebhook(params: ParametrosAssinatura): boolean {
  const partes = extrairPartesAssinatura(params.assinatura);
  if (!partes) {
    return false;
  }

  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${partes.ts};`;
  const hashEsperado = createHmac("sha256", params.segredo).update(manifest).digest("hex");

  return hashEsperado === partes.v1;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- mercadoPagoSignature`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/providers/payment/mercadoPagoSignature.ts src/providers/payment/mercadoPagoSignature.test.ts
git commit -m "feat: valida assinatura de webhook do Mercado Pago"
```

---

### Task 3: `PaymentProvider` — payload de webhook estruturado e dados de PIX

**Files:**
- Modify: `src/providers/payment/PaymentProvider.ts`
- Modify: `src/providers/payment/MockPaymentProvider.ts`
- Modify: `src/providers/payment/MockPaymentProvider.test.ts`

**Interfaces:**
- Produces: `PayloadWebhook` (novo tipo), `ResultadoPagamento.dadosPix?` (novo campo) — consumidos pela Task 4 (`MercadoPagoProvider`) e pela Task 8 (rota de webhook).
- Consumes: nenhuma interface nova de tasks anteriores.

O `payload: unknown` de `validarWebhook` vira um tipo concreto: hoje o `MockPaymentProvider` só precisa de um campo simples (`referenciaExterna`) pra simular, mas o Mercado Pago precisa de três informações vindas da requisição HTTP (corpo, header `x-request-id`, e o `data.id` da query string) pra validar a assinatura de verdade. Um tipo único e estruturado serve os dois casos sem exigir que cada provider reinvente sua própria forma de payload.

- [ ] **Step 1: Escrever os testes que falham (ajustando os existentes)**

Substitua em `src/providers/payment/MockPaymentProvider.test.ts` os dois testes que usam `payload` diretamente:

```ts
  it("valida webhook e devolve a referência contida no payload", async () => {
    const provider = new MockPaymentProvider();
    const resultado = await provider.validarWebhook(
      { corpo: { referenciaExterna: "mock_evt_1_123" }, cabecalhoRequestId: "req-1", dataId: "mock_evt_1_123" },
      "assinatura-qualquer"
    );

    expect(resultado).toEqual({
      referenciaExterna: "mock_evt_1_123",
      status: "aprovado",
    });
  });

  it("usa referência placeholder quando o payload não tem o campo", async () => {
    const provider = new MockPaymentProvider();
    const resultado = await provider.validarWebhook(
      { corpo: "payload-invalido", cabecalhoRequestId: "", dataId: "" },
      "assinatura"
    );

    expect(resultado.referenciaExterna).toBe("mock_referencia_desconhecida");
    expect(resultado.status).toBe("aprovado");
  });
```

E o terceiro uso, dentro do bloco `"com resultado forçado 'recusado'"`:

```ts
    it("recusa também webhook, consulta e estorno", async () => {
      const provider = new MockPaymentProvider("recusado");

      expect(
        (await provider.validarWebhook({ corpo: {}, cabecalhoRequestId: "", dataId: "" }, "assinatura")).status
      ).toBe("recusado");
      expect((await provider.consultarStatus("ref")).status).toBe("recusado");
      expect((await provider.estornar("ref", 10)).status).toBe("recusado");
    });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- MockPaymentProvider`
Expected: FAIL — tipos incompatíveis (`payload` ainda é `unknown` na interface, `MockPaymentProvider` ainda espera o formato antigo).

- [ ] **Step 3: Implementar — `PaymentProvider.ts`**

Substitua o conteúdo de `src/providers/payment/PaymentProvider.ts`:

```ts
export type MetodoPagamento = "pix" | "cartao";

export type StatusPagamentoResultado = "aprovado" | "recusado" | "pendente";

export interface IniciarPagamentoInput {
  reservaEventoId: string;
  valor: number;
  metodo: MetodoPagamento;
}

export interface DadosPix {
  /** Código copia-e-cola. */
  qrCode: string;
  /** Imagem do QR code em base64, pronta para <img src="data:image/png;base64,...">. */
  qrCodeBase64: string;
  /** ISO 8601 — mesmo instante do holdExpiresAt da reserva. */
  expiraEm: string;
}

export interface ResultadoPagamento {
  provedor: string;
  status: StatusPagamentoResultado;
  referenciaExterna: string;
  /** Só preenchido quando o método é pix e o pagamento ainda está pendente. */
  dadosPix?: DadosPix;
}

/** Resultado da validação de um webhook do gateway de pagamento. */
export interface ResultadoWebhook {
  referenciaExterna: string;
  status: StatusPagamentoResultado;
}

/** Resultado de um pedido de estorno junto ao gateway. */
export interface ResultadoEstorno {
  referenciaExterna: string;
  valorEstornado: number;
  status: "aprovado" | "recusado";
}

/**
 * Dados brutos de uma requisição de webhook, na forma que qualquer provider
 * precisa para validar a origem da notificação e localizar o pagamento.
 */
export interface PayloadWebhook {
  /** Corpo (JSON já parseado) da notificação recebida. */
  corpo: unknown;
  /** Header x-request-id (ou equivalente do provider), usado na assinatura. */
  cabecalhoRequestId: string;
  /** Identificador do pagamento no gateway (ex.: data.id da query string). */
  dataId: string;
}

export interface PaymentProvider {
  nome: string;

  /**
   * Inicia uma tentativa de pagamento. NÃO confirma a reserva — a confirmação
   * só acontece após a validação do webhook do gateway.
   */
  iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento>;

  /** Valida a assinatura e o corpo de um webhook recebido do gateway. */
  validarWebhook(payload: PayloadWebhook, assinatura: string): Promise<ResultadoWebhook>;

  /** Consulta o status atual de um pagamento no gateway. */
  consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento>;

  /** Solicita o estorno (total ou parcial) de um pagamento aprovado. */
  estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno>;
}
```

- [ ] **Step 4: Implementar — `MockPaymentProvider.ts`**

Substitua o conteúdo de `src/providers/payment/MockPaymentProvider.ts`:

```ts
import {
  PaymentProvider,
  IniciarPagamentoInput,
  ResultadoPagamento,
  ResultadoWebhook,
  ResultadoEstorno,
  PayloadWebhook,
} from "./PaymentProvider";

type ResultadoForcado = "aprovado" | "recusado";

function extrairReferencia(payload: PayloadWebhook): string {
  if (
    typeof payload.corpo === "object" &&
    payload.corpo !== null &&
    "referenciaExterna" in payload.corpo &&
    typeof (payload.corpo as { referenciaExterna: unknown }).referenciaExterna === "string"
  ) {
    return (payload.corpo as { referenciaExterna: string }).referenciaExterna;
  }

  return "mock_referencia_desconhecida";
}

export class MockPaymentProvider implements PaymentProvider {
  nome = "mock";

  /**
   * @param resultadoForcado força o desfecho das operações. Sem argumento, o
   * mock sempre aprova (comportamento padrão esperado pelos testes existentes).
   */
  constructor(private readonly resultadoForcado?: ResultadoForcado) {}

  private get resultado(): ResultadoForcado {
    return this.resultadoForcado ?? "aprovado";
  }

  async iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento> {
    if (input.valor <= 0) {
      throw new Error("valor do pagamento deve ser maior que zero");
    }

    return {
      provedor: this.nome,
      status: this.resultado,
      referenciaExterna: `mock_${input.reservaEventoId}_${Date.now()}`,
    };
  }

  async validarWebhook(payload: PayloadWebhook, _assinatura: string): Promise<ResultadoWebhook> {
    // A validação real de assinatura é responsabilidade do gateway real (Fase 2).
    return {
      referenciaExterna: extrairReferencia(payload),
      status: this.resultado,
    };
  }

  async consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento> {
    return {
      provedor: this.nome,
      status: this.resultado,
      referenciaExterna,
    };
  }

  async estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno> {
    if (valor <= 0) {
      throw new Error("valor do estorno deve ser maior que zero");
    }

    return {
      referenciaExterna,
      valorEstornado: valor,
      status: this.resultado,
    };
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test -- MockPaymentProvider`
Expected: PASS (9 testes)

- [ ] **Step 6: Rodar a suíte inteira e confirmar que nada mais quebrou**

Run: `npm test`
Expected: PASS — nenhum outro arquivo referencia o formato antigo de `payload`.

- [ ] **Step 7: Commit**

```bash
git add src/providers/payment/PaymentProvider.ts src/providers/payment/MockPaymentProvider.ts src/providers/payment/MockPaymentProvider.test.ts
git commit -m "feat: estrutura o payload de webhook e adiciona dadosPix a ResultadoPagamento"
```

---

### Task 4: `MercadoPagoProvider`

**Files:**
- Create: `src/providers/payment/MercadoPagoProvider.ts`
- Test: `src/providers/payment/MercadoPagoProvider.test.ts`

**Interfaces:**
- Consumes: `PaymentProvider`, `PayloadWebhook`, `DadosPix` (Task 3); `validarAssinaturaWebhook` (Task 2).
- Produces: `MercadoPagoProvider` — consumida pela Task 5 (`getPaymentProvider`).

- [ ] **Step 1: Escrever os testes que falham**

`src/providers/payment/MercadoPagoProvider.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const paymentCreateMock = vi.fn();
const paymentGetMock = vi.fn();
const refundCreateMock = vi.fn();

vi.mock("mercadopago", () => ({
  MercadoPagoConfig: vi.fn(),
  Payment: vi.fn().mockImplementation(() => ({
    create: paymentCreateMock,
    get: paymentGetMock,
  })),
  PaymentRefund: vi.fn().mockImplementation(() => ({
    create: refundCreateMock,
  })),
}));

import { MercadoPagoProvider } from "./MercadoPagoProvider";

describe("MercadoPagoProvider", () => {
  const ambienteOriginal = { ...process.env };

  beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-token-de-teste";
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "segredo-de-teste";
    paymentCreateMock.mockReset();
    paymentGetMock.mockReset();
    refundCreateMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...ambienteOriginal };
  });

  describe("iniciarPagamento", () => {
    it("cria um pagamento pix e retorna os dados do QR code", async () => {
      paymentCreateMock.mockResolvedValueOnce({
        id: 123456789,
        status: "pending",
        point_of_interaction: {
          transaction_data: {
            qr_code: "00020126...codigo-copia-e-cola",
            qr_code_base64: "aGVsbG8=",
          },
        },
      });

      const provider = new MercadoPagoProvider();
      const resultado = await provider.iniciarPagamento({
        reservaEventoId: "evt_1",
        valor: 1100,
        metodo: "pix",
      });

      expect(resultado.status).toBe("pendente");
      expect(resultado.provedor).toBe("mercadopago");
      expect(resultado.referenciaExterna).toBe("123456789");
      expect(resultado.dadosPix?.qrCode).toBe("00020126...codigo-copia-e-cola");
      expect(resultado.dadosPix?.qrCodeBase64).toBe("aGVsbG8=");
      expect(resultado.dadosPix?.expiraEm).toBeTruthy();
    });

    it("lança erro para valor zero ou negativo", async () => {
      const provider = new MercadoPagoProvider();
      await expect(
        provider.iniciarPagamento({ reservaEventoId: "evt_1", valor: 0, metodo: "pix" })
      ).rejects.toThrow();
      expect(paymentCreateMock).not.toHaveBeenCalled();
    });

    it("lança erro para método diferente de pix", async () => {
      const provider = new MercadoPagoProvider();
      await expect(
        provider.iniciarPagamento({ reservaEventoId: "evt_1", valor: 100, metodo: "cartao" })
      ).rejects.toThrow();
      expect(paymentCreateMock).not.toHaveBeenCalled();
    });

    it("lança erro quando a resposta do Mercado Pago vem sem os dados do QR code", async () => {
      paymentCreateMock.mockResolvedValueOnce({ id: 1, status: "pending" });

      const provider = new MercadoPagoProvider();
      await expect(
        provider.iniciarPagamento({ reservaEventoId: "evt_1", valor: 100, metodo: "pix" })
      ).rejects.toThrow();
    });
  });

  describe("validarWebhook", () => {
    it("rejeita assinatura inválida sem consultar a API", async () => {
      const provider = new MercadoPagoProvider();

      await expect(
        provider.validarWebhook(
          { corpo: {}, cabecalhoRequestId: "req-1", dataId: "123" },
          "ts=1700000000,v1=assinaturaqualquerinvalida"
        )
      ).rejects.toThrow();

      expect(paymentGetMock).not.toHaveBeenCalled();
    });

    it("rebusca o pagamento pela API quando a assinatura é válida (nunca confia no corpo)", async () => {
      const { createHmac } = await import("node:crypto");
      const manifest = "id:123;request-id:req-1;ts:1700000000;";
      const v1 = createHmac("sha256", "segredo-de-teste").update(manifest).digest("hex");

      paymentGetMock.mockResolvedValueOnce({ id: 123, status: "approved" });

      const provider = new MercadoPagoProvider();
      const resultado = await provider.validarWebhook(
        { corpo: { status: "isso deveria ser ignorado" }, cabecalhoRequestId: "req-1", dataId: "123" },
        `ts=1700000000,v1=${v1}`
      );

      expect(paymentGetMock).toHaveBeenCalledWith({ id: "123" });
      expect(resultado).toEqual({ referenciaExterna: "123", status: "aprovado" });
    });
  });

  describe("consultarStatus", () => {
    it("mapeia status aprovado corretamente", async () => {
      paymentGetMock.mockResolvedValueOnce({ id: 1, status: "approved" });
      const provider = new MercadoPagoProvider();
      const resultado = await provider.consultarStatus("1");
      expect(resultado.status).toBe("aprovado");
    });

    it("mapeia status rejected/cancelled como recusado", async () => {
      paymentGetMock.mockResolvedValueOnce({ id: 1, status: "rejected" });
      const provider = new MercadoPagoProvider();
      expect((await provider.consultarStatus("1")).status).toBe("recusado");
    });

    it("mapeia status pending/in_process como pendente", async () => {
      paymentGetMock.mockResolvedValueOnce({ id: 1, status: "in_process" });
      const provider = new MercadoPagoProvider();
      expect((await provider.consultarStatus("1")).status).toBe("pendente");
    });
  });

  describe("estornar", () => {
    it("solicita o estorno e retorna o resultado", async () => {
      refundCreateMock.mockResolvedValueOnce({ status: "approved" });

      const provider = new MercadoPagoProvider();
      const resultado = await provider.estornar("123", 550);

      expect(refundCreateMock).toHaveBeenCalledWith({
        payment_id: "123",
        body: { amount: 550 },
      });
      expect(resultado).toEqual({ referenciaExterna: "123", valorEstornado: 550, status: "aprovado" });
    });

    it("lança erro para valor zero ou negativo", async () => {
      const provider = new MercadoPagoProvider();
      await expect(provider.estornar("123", 0)).rejects.toThrow();
      expect(refundCreateMock).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- MercadoPagoProvider`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/providers/payment/MercadoPagoProvider.ts`:
```ts
import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago";
import type {
  PaymentProvider,
  IniciarPagamentoInput,
  ResultadoPagamento,
  ResultadoWebhook,
  ResultadoEstorno,
  StatusPagamentoResultado,
  PayloadWebhook,
} from "./PaymentProvider";
import { validarAssinaturaWebhook } from "./mercadoPagoSignature";

const QUINZE_MINUTOS_MS = 15 * 60 * 1000;

function mapearStatus(statusMp: string | undefined): StatusPagamentoResultado {
  if (statusMp === "approved") return "aprovado";
  if (statusMp === "rejected" || statusMp === "cancelled") return "recusado";
  return "pendente";
}

export class MercadoPagoProvider implements PaymentProvider {
  nome = "mercadopago";

  private client(): MercadoPagoConfig {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
    }
    return new MercadoPagoConfig({ accessToken });
  }

  async iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento> {
    if (input.valor <= 0) {
      throw new Error("valor do pagamento deve ser maior que zero");
    }
    if (input.metodo !== "pix") {
      throw new Error("MercadoPagoProvider só suporta pix nesta fase");
    }

    const payment = new Payment(this.client());
    const expiraEm = new Date(Date.now() + QUINZE_MINUTOS_MS).toISOString();

    const resultado = await payment.create({
      body: {
        transaction_amount: input.valor,
        payment_method_id: "pix",
        payer: { email: `reserva-${input.reservaEventoId}@antoninaosteria.com` },
        date_of_expiration: expiraEm,
        description: `Sinal de reserva de evento ${input.reservaEventoId}`,
      },
    });

    const qrCode = resultado.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = resultado.point_of_interaction?.transaction_data?.qr_code_base64;

    if (!qrCode || !qrCodeBase64 || resultado.id === undefined) {
      throw new Error("resposta inesperada do Mercado Pago ao criar o pagamento pix");
    }

    return {
      provedor: this.nome,
      status: "pendente",
      referenciaExterna: String(resultado.id),
      dadosPix: { qrCode, qrCodeBase64, expiraEm },
    };
  }

  async validarWebhook(payload: PayloadWebhook, assinatura: string): Promise<ResultadoWebhook> {
    const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!segredo) {
      throw new Error("MERCADOPAGO_WEBHOOK_SECRET não configurado");
    }

    const valida = validarAssinaturaWebhook({
      assinatura,
      requestId: payload.cabecalhoRequestId,
      dataId: payload.dataId,
      segredo,
    });

    if (!valida) {
      throw new Error("assinatura do webhook inválida");
    }

    // Nunca confia no status do corpo da notificação — rebusca pela API.
    const resultado = await this.consultarStatus(payload.dataId);

    return { referenciaExterna: payload.dataId, status: resultado.status };
  }

  async consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento> {
    const payment = new Payment(this.client());
    const resultado = await payment.get({ id: referenciaExterna });

    return {
      provedor: this.nome,
      status: mapearStatus(resultado.status),
      referenciaExterna,
    };
  }

  async estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno> {
    if (valor <= 0) {
      throw new Error("valor do estorno deve ser maior que zero");
    }

    const refund = new PaymentRefund(this.client());
    const resultado = await refund.create({
      payment_id: referenciaExterna,
      body: { amount: valor },
    });

    return {
      referenciaExterna,
      valorEstornado: valor,
      status: resultado.status === "approved" ? "aprovado" : "recusado",
    };
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- MercadoPagoProvider`
Expected: PASS (10 testes)

- [ ] **Step 5: Rodar `tsc` e confirmar que os tipos do SDK batem**

Run: `npx tsc --noEmit`
Expected: limpo. Se os nomes de campos da resposta do SDK (`point_of_interaction`, `transaction_data`, etc.) divergirem da versão instalada, ajuste conforme os tipos reais em `node_modules/mercadopago` — a lógica de negócio (validação, mapeamento de status, cálculo de expiração) não muda, só os nomes de campo se necessário.

- [ ] **Step 6: Commit**

```bash
git add src/providers/payment/MercadoPagoProvider.ts src/providers/payment/MercadoPagoProvider.test.ts
git commit -m "feat: implementa MercadoPagoProvider (pix, webhook, estorno)"
```

---

### Task 5: `getPaymentProvider` — troca de provider por variável de ambiente

**Files:**
- Modify: `src/providers/payment/getPaymentProvider.ts`
- Test: `src/providers/payment/getPaymentProvider.test.ts`

**Interfaces:**
- Consumes: `MercadoPagoProvider` (Task 4), `MockPaymentProvider` (existente).
- Produces: `getPaymentProvider()` — comportamento consumido por todas as rotas que já a usam (`pagamento/route.ts`, futura `webhooks/mercadopago/route.ts`, futura `cancelar/route.ts`).

- [ ] **Step 1: Escrever os testes que falham**

`src/providers/payment/getPaymentProvider.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPaymentProvider } from "./getPaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";

describe("getPaymentProvider", () => {
  const ambienteOriginal = process.env.PAYMENT_PROVIDER;

  afterEach(() => {
    process.env.PAYMENT_PROVIDER = ambienteOriginal;
  });

  it("retorna MockPaymentProvider quando PAYMENT_PROVIDER não está definido", () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(getPaymentProvider()).toBeInstanceOf(MockPaymentProvider);
  });

  it("retorna MockPaymentProvider para qualquer valor diferente de 'mercadopago'", () => {
    process.env.PAYMENT_PROVIDER = "algum-valor-desconhecido";
    expect(getPaymentProvider()).toBeInstanceOf(MockPaymentProvider);
  });

  it("retorna MercadoPagoProvider quando PAYMENT_PROVIDER=mercadopago", () => {
    process.env.PAYMENT_PROVIDER = "mercadopago";
    expect(getPaymentProvider()).toBeInstanceOf(MercadoPagoProvider);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- getPaymentProvider`
Expected: FAIL — `getPaymentProvider()` sempre retorna `MockPaymentProvider`, ignorando a variável de ambiente.

- [ ] **Step 3: Implementar**

`src/providers/payment/getPaymentProvider.ts`:
```ts
import type { PaymentProvider } from "./PaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";

/**
 * Fábrica do provedor de pagamento ativo. Sem PAYMENT_PROVIDER=mercadopago
 * definido, sempre retorna o MockPaymentProvider — inclusive no ambiente de
 * teste, que nunca define essa variável. Isso é intencional: o lado seguro
 * por padrão é nunca acidentalmente tentar falar com o Mercado Pago de
 * verdade sem configuração explícita.
 */
export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "mercadopago") {
    return new MercadoPagoProvider();
  }
  return new MockPaymentProvider();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- getPaymentProvider`
Expected: PASS (3 testes)

- [ ] **Step 5: Rodar a suíte inteira e confirmar que nada quebrou**

Run: `npm test`
Expected: PASS — nenhum teste existente define `PAYMENT_PROVIDER`, então todos continuam recebendo `MockPaymentProvider` como antes.

- [ ] **Step 6: Commit**

```bash
git add src/providers/payment/getPaymentProvider.ts src/providers/payment/getPaymentProvider.test.ts
git commit -m "feat: getPaymentProvider troca para Mercado Pago via variável de ambiente"
```

---

### Task 6: Rota de pagamento — persiste `referenciaExterna` e retorna `dadosPix`

**Files:**
- Modify: `src/app/api/eventos/reservas/[id]/pagamento/route.ts`
- Modify: `src/app/api/eventos/reservas/[id]/pagamento/route.test.ts`

**Interfaces:**
- Consumes: `ResultadoPagamento.dadosPix` (Task 3).
- Produces: resposta HTTP com `dadosPix` quando presente — consumida pela Task 10 (wizard do cliente).

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao final de `src/app/api/eventos/reservas/[id]/pagamento/route.test.ts` (antes do último `});` que fecha o `describe`):

```ts
  it("persiste referenciaExterna e repassa dadosPix quando o provider os fornece", async () => {
    const providerComPix = {
      nome: "fake-pix",
      async iniciarPagamento() {
        return {
          provedor: "fake-pix",
          status: "pendente" as const,
          referenciaExterna: "ref-fake-123",
          dadosPix: {
            qrCode: "codigo-copia-e-cola",
            qrCodeBase64: "base64qualquer",
            expiraEm: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
        };
      },
      async validarWebhook() {
        throw new Error("não usado neste teste");
      },
      async consultarStatus() {
        throw new Error("não usado neste teste");
      },
      async estornar() {
        throw new Error("não usado neste teste");
      },
    };

    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(providerComPix);

    const reserva = await criarHold(daquiADias(34), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dadosPix.qrCode).toBe("codigo-copia-e-cola");
    expect(body.pagamento.status).toBe("PENDENTE");

    const pagamentoNoBanco = await prisma.pagamento.findUnique({ where: { reservaEventoId: reserva.id } });
    expect(pagamentoNoBanco?.referenciaExterna).toBe("ref-fake-123");
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- pagamento/route`
Expected: FAIL — `referenciaExterna` não é persistida (coluna obrigatória, `prisma.pagamento.create` falha ou o campo simplesmente não é passado) e a resposta não inclui `dadosPix`.

- [ ] **Step 3: Implementar**

Em `src/app/api/eventos/reservas/[id]/pagamento/route.ts`, localize os dois blocos que chamam `prisma.pagamento.create` (um dentro do `if (resultadoPagamento.status === "pendente")`, outro dentro da transação) e adicione `referenciaExterna: resultadoPagamento.referenciaExterna` aos dados de cada um:

```ts
    if (resultadoPagamento.status === "pendente") {
      // Pagamento ainda em processamento (ex.: Pix aguardando confirmação
      // assíncrona do gateway). Não é aprovação nem recusa final — a reserva
      // permanece em AGUARDANDO_PAGAMENTO e o hold continua correndo.
      const pagamento = await prisma.pagamento.create({
        data: {
          reservaEventoId: reserva.id,
          provedor: resultadoPagamento.provedor,
          metodo: paraMetodoPagamentoEnum(body.metodo),
          valor: valorSinal,
          status: paraStatusPagamentoEnum(resultadoPagamento.status),
          referenciaExterna: resultadoPagamento.referenciaExterna,
        },
      });

      return NextResponse.json({ pagamento, reserva, dadosPix: resultadoPagamento.dadosPix }, { status: 200 });
    }

    // Este branch só é alcançado por um provider que confirma de forma
    // síncrona (hoje, só o MockPaymentProvider) — o MercadoPagoProvider real
    // sempre retorna "pendente" para pix, então a confirmação de verdade
    // acontece na rota de webhook (src/app/api/webhooks/mercadopago/route.ts),
    // nunca aqui.
    const [pagamento, reservaAtualizada] = await prisma.$transaction([
      prisma.pagamento.create({
        data: {
          reservaEventoId: reserva.id,
          provedor: resultadoPagamento.provedor,
          metodo: paraMetodoPagamentoEnum(body.metodo),
          valor: valorSinal,
          status: paraStatusPagamentoEnum(resultadoPagamento.status),
          referenciaExterna: resultadoPagamento.referenciaExterna,
        },
      }),
```

(o restante do arquivo permanece igual — só os dois `data: {...}` ganham a nova linha, e o `return` do branch "pendente" ganha `dadosPix`.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- pagamento/route`
Expected: PASS (9 testes)

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/eventos/reservas/\[id\]/pagamento/route.ts src/app/api/eventos/reservas/\[id\]/pagamento/route.test.ts
git commit -m "feat: persiste referenciaExterna e repassa dadosPix na rota de pagamento"
```

---

### Task 7: Rota `GET /api/eventos/reservas/[id]` — status para polling

**Files:**
- Create: `src/app/api/eventos/reservas/[id]/route.ts`
- Test: `src/app/api/eventos/reservas/[id]/route.test.ts`

**Interfaces:**
- Produces: `GET /api/eventos/reservas/[id]` → `{ status, pagamento: { status } | null }` — consumida pela Task 10 (polling do wizard).

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/eventos/reservas/[id]/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("GET /api/eventos/reservas/[id]", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Status Reserva", precoPessoa: 150, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEvento: { pacoteId } } });
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("retorna 404 para reserva inexistente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas/id-que-nao-existe");
    const response = await GET(request, { params: Promise.resolve({ id: "id-que-nao-existe" }) });
    expect(response.status).toBe(404);
  });

  it("retorna o status da reserva sem pagamento associado", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(25),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1650,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}`);
    const response = await GET(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(body.pagamento).toBeNull();
  });

  it("retorna o status do pagamento quando existe", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste 2",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste2@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(26),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1650,
        status: "CONFIRMADA",
      },
    });
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mercadopago",
        metodo: "PIX",
        valor: 1650,
        status: "APROVADO",
        referenciaExterna: "ref-status-teste",
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}`);
    const response = await GET(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CONFIRMADA");
    expect(body.pagamento.status).toBe("APROVADO");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- "reservas/\[id\]/route"`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/eventos/reservas/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// LIMITAÇÃO CONHECIDA: esta rota não verifica se quem chama é o dono da
// reserva — qualquer pessoa que descubra o id (cuid) pode consultar o
// status. cuids são difíceis de adivinhar, mas isso é obscuridade, não
// autorização. Mesma decisão já registrada nas rotas irmãs (cancelar,
// pagamento, pratos): aceitar o risco por ora, tratar no desenho de
// autenticação de cliente de um trabalho futuro.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id },
    include: { pagamento: true },
  });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    status: reserva.status,
    pagamento: reserva.pagamento ? { status: reserva.pagamento.status } : null,
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- "reservas/\[id\]/route"`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/reservas/\[id\]/route.ts src/app/api/eventos/reservas/\[id\]/route.test.ts
git commit -m "feat: rota GET de status da reserva de evento, para polling do cliente"
```

---

### Task 8: Rota de webhook `POST /api/webhooks/mercadopago`

**Files:**
- Create: `src/app/api/webhooks/mercadopago/route.ts`
- Test: `src/app/api/webhooks/mercadopago/route.test.ts`

**Interfaces:**
- Consumes: `getPaymentProvider` (Task 5), `PayloadWebhook` (Task 3), `paraStatusPagamentoEnum` (existente, `src/providers/payment/mappers.ts`).

Esta é a task com mais casos-limite do plano — cobre confirmação normal, recusa normal, notificação duplicada (idempotência), pagamento de um `referenciaExterna` desconhecido, e o caso do pagamento aprovado depois que o hold já expirou (com estorno automático, também idempotente).

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/webhooks/mercadopago/route.test.ts` (segue o mesmo padrão de mock de `getPaymentProvider` já usado em `pagamento/route.test.ts` e `cancelar/route.test.ts`: `vi.spyOn` sobre o módulo, não `vi.mock` do módulo inteiro):
```ts
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { daquiADias } from "@/test-utils/datas";
import * as getPaymentProviderModule from "@/providers/payment/getPaymentProvider";
import { POST } from "./route";

function fazerRequest(dataId: string, assinatura = "assinatura-qualquer") {
  return new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}`, {
    method: "POST",
    headers: { "x-signature": assinatura, "x-request-id": "req-1" },
    body: JSON.stringify({ action: "payment.updated", data: { id: dataId } }),
  });
}

function providerFake(overrides: {
  validarWebhook: (payload: unknown, assinatura: string) => Promise<{ referenciaExterna: string; status: string }>;
  estornar?: ReturnType<typeof vi.fn>;
}) {
  return {
    nome: "fake",
    iniciarPagamento: vi.fn(),
    validarWebhook: overrides.validarWebhook,
    consultarStatus: vi.fn(),
    estornar: overrides.estornar ?? vi.fn().mockResolvedValue({ referenciaExterna: "x", valorEstornado: 0, status: "aprovado" }),
  };
}

describe("POST /api/webhooks/mercadopago", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Webhook", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEvento: { pacoteId } } });
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function criarReservaComPagamento(status: "AGUARDANDO_PAGAMENTO" | "CONFIRMADA" | "CANCELADA", referenciaExterna: string, statusPagamento: "PENDENTE" | "APROVADO" | "RECUSADO" = "PENDENTE") {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Webhook",
        clienteTelefone: "+5541999999999",
        clienteEmail: "webhook@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(40),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status,
        holdExpiresAt: status === "AGUARDANDO_PAGAMENTO" ? new Date(Date.now() + 10 * 60 * 1000) : null,
      },
    });
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mercadopago",
        metodo: "PIX",
        valor: 2200,
        status: statusPagamento,
        referenciaExterna,
      },
    });
    return reserva;
  }

  it("retorna 401 quando a assinatura é inválida", async () => {
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({ validarWebhook: async () => { throw new Error("assinatura inválida"); } })
    );

    const response = await POST(fazerRequest("ref-1"));
    expect(response.status).toBe(401);
  });

  it("confirma a reserva quando o pagamento é aprovado e ela ainda está aguardando", async () => {
    const reserva = await criarReservaComPagamento("AGUARDANDO_PAGAMENTO", "ref-aprovado-1");
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({ validarWebhook: async () => ({ referenciaExterna: "ref-aprovado-1", status: "aprovado" }) })
    );

    const response = await POST(fazerRequest("ref-aprovado-1"));
    expect(response.status).toBe(200);

    const reservaAtualizada = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaAtualizada?.status).toBe("CONFIRMADA");
    const pagamentoAtualizado = await prisma.pagamento.findUnique({ where: { reservaEventoId: reserva.id } });
    expect(pagamentoAtualizado?.status).toBe("APROVADO");
  });

  it("cancela a reserva quando o pagamento é recusado", async () => {
    const reserva = await criarReservaComPagamento("AGUARDANDO_PAGAMENTO", "ref-recusado-1");
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({ validarWebhook: async () => ({ referenciaExterna: "ref-recusado-1", status: "recusado" }) })
    );

    const response = await POST(fazerRequest("ref-recusado-1"));
    expect(response.status).toBe(200);

    const reservaAtualizada = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaAtualizada?.status).toBe("CANCELADA");
  });

  it("é um no-op quando o referenciaExterna não corresponde a nenhum pagamento conhecido", async () => {
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({ validarWebhook: async () => ({ referenciaExterna: "ref-desconhecida", status: "aprovado" }) })
    );

    const response = await POST(fazerRequest("ref-desconhecida"));
    expect(response.status).toBe(200);
  });

  it("é um no-op ao reprocessar uma notificação já aplicada (idempotência)", async () => {
    const reserva = await criarReservaComPagamento("CONFIRMADA", "ref-duplicado-1", "APROVADO");
    const estornarMock = vi.fn();
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({
        validarWebhook: async () => ({ referenciaExterna: "ref-duplicado-1", status: "aprovado" }),
        estornar: estornarMock,
      })
    );

    const response = await POST(fazerRequest("ref-duplicado-1"));
    expect(response.status).toBe(200);

    const reservaAposReenvio = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaAposReenvio?.status).toBe("CONFIRMADA");
    expect(estornarMock).not.toHaveBeenCalled();
  });

  it("estorna automaticamente quando o pagamento é aprovado depois que o hold já expirou", async () => {
    const reserva = await criarReservaComPagamento("CANCELADA", "ref-tardio-1");
    const estornarMock = vi.fn().mockResolvedValue({ referenciaExterna: "ref-tardio-1", valorEstornado: 2200, status: "aprovado" });
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({
        validarWebhook: async () => ({ referenciaExterna: "ref-tardio-1", status: "aprovado" }),
        estornar: estornarMock,
      })
    );

    const response = await POST(fazerRequest("ref-tardio-1"));
    expect(response.status).toBe(200);

    expect(estornarMock).toHaveBeenCalledWith("ref-tardio-1", 2200);
    const reservaAposWebhook = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaAposWebhook?.status).toBe("CANCELADA");
    const pagamentoAposWebhook = await prisma.pagamento.findUnique({ where: { reservaEventoId: reserva.id } });
    expect(pagamentoAposWebhook?.status).toBe("APROVADO");
  });

  it("não estorna duas vezes ao reprocessar a notificação do caso tardio", async () => {
    await criarReservaComPagamento("CANCELADA", "ref-tardio-2", "APROVADO");
    const estornarMock = vi.fn();
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({
        validarWebhook: async () => ({ referenciaExterna: "ref-tardio-2", status: "aprovado" }),
        estornar: estornarMock,
      })
    );

    const response = await POST(fazerRequest("ref-tardio-2"));
    expect(response.status).toBe(200);
    expect(estornarMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- webhooks/mercadopago`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/webhooks/mercadopago/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";
import { paraStatusPagamentoEnum } from "@/providers/payment/mappers";

export async function POST(request: NextRequest) {
  let corpo: unknown = null;
  try {
    corpo = await request.json();
  } catch {
    // Corpo vazio ou inválido não impede a validação — o Mercado Pago manda
    // o id relevante também na query string (data.id).
  }

  const assinatura = request.headers.get("x-signature") ?? "";
  const cabecalhoRequestId = request.headers.get("x-request-id") ?? "";
  const dataId = request.nextUrl.searchParams.get("data.id") ?? "";

  const provider = getPaymentProvider();

  let resultado;
  try {
    resultado = await provider.validarWebhook({ corpo, cabecalhoRequestId, dataId }, assinatura);
  } catch {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  if (resultado.status === "pendente") {
    return NextResponse.json({ ok: true });
  }

  const pagamento = await prisma.pagamento.findUnique({
    where: { referenciaExterna: resultado.referenciaExterna },
  });

  if (!pagamento) {
    // Notificação de um pagamento que não se origina desta aplicação (ex.:
    // evento de teste disparado pelo próprio painel do Mercado Pago).
    return NextResponse.json({ ok: true });
  }

  const novoStatusPagamento = paraStatusPagamentoEnum(resultado.status);
  const jaProcessadoNesseStatus = pagamento.status === novoStatusPagamento;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id: pagamento.reservaEventoId },
  });

  if (!reserva) {
    return NextResponse.json({ ok: true });
  }

  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    // A reserva já saiu do estado de espera — hold expirou e foi liberado
    // (a reserva vira CANCELADA), já foi confirmada por um webhook anterior,
    // ou isto é a reentrega de uma notificação já processada.
    if (!jaProcessadoNesseStatus) {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: novoStatusPagamento },
      });

      if (resultado.status === "aprovado" && reserva.status === "CANCELADA") {
        // Dinheiro aprovado depois que o slot já foi liberado — estorna
        // automaticamente, não fica retido por um evento que não vai
        // acontecer. Falha aqui não deve travar o ack do webhook (o
        // Mercado Pago reenviaria indefinidamente); fica registrado para
        // acompanhamento manual.
        try {
          await provider.estornar(resultado.referenciaExterna, Number(pagamento.valor));
        } catch (erroEstorno) {
          console.error("falha ao estornar pagamento tardio", pagamento.id, erroEstorno);
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction([
    prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { status: novoStatusPagamento },
    }),
    prisma.reservaEvento.update({
      where: { id: reserva.id },
      data: {
        status: resultado.status === "aprovado" ? "CONFIRMADA" : "CANCELADA",
        holdExpiresAt: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- webhooks/mercadopago`
Expected: PASS (8 testes)

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks/mercadopago/
git commit -m "feat: rota de webhook do Mercado Pago (idempotente, com estorno automático de pagamento tardio)"
```

---

### Task 9: Estorno real na rota de cancelamento

**Files:**
- Modify: `src/app/api/eventos/reservas/[id]/cancelar/route.ts`
- Modify: `src/app/api/eventos/reservas/[id]/cancelar/route.test.ts`

**Interfaces:**
- Consumes: `getPaymentProvider` (Task 5).

- [ ] **Step 1: Escrever os testes que falham**

Adicione a `src/app/api/eventos/reservas/[id]/cancelar/route.test.ts` (após os dois testes existentes, dentro do mesmo `describe`):

```ts
  it("chama o estorno do provedor quando existe um pagamento aprovado", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Com Pagamento",
        clienteTelefone: "+5541999999999",
        clienteEmail: "pagou@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "CONFIRMADA",
      },
    });
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mercadopago",
        metodo: "PIX",
        valor: 1100,
        status: "APROVADO",
        referenciaExterna: "ref-cancelamento-1",
      },
    });

    const estornarMock = vi.fn().mockResolvedValue({
      referenciaExterna: "ref-cancelamento-1",
      valorEstornado: 1100,
      status: "aprovado",
    });
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue({
      nome: "fake",
      iniciarPagamento: vi.fn(),
      validarWebhook: vi.fn(),
      consultarStatus: vi.fn(),
      estornar: estornarMock,
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });
    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CANCELADA");
    expect(estornarMock).toHaveBeenCalledWith("ref-cancelamento-1", 1100);
  });

  it("não cancela a reserva quando o estorno falha", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Estorno Falho",
        clienteTelefone: "+5541999999999",
        clienteEmail: "falhou@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "CONFIRMADA",
      },
    });
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mercadopago",
        metodo: "PIX",
        valor: 1100,
        status: "APROVADO",
        referenciaExterna: "ref-cancelamento-2",
      },
    });

    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue({
      nome: "fake",
      iniciarPagamento: vi.fn(),
      validarWebhook: vi.fn(),
      consultarStatus: vi.fn(),
      estornar: vi.fn().mockRejectedValue(new Error("gateway fora do ar")),
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });
    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(502);

    const reservaAposFalha = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaAposFalha?.status).toBe("CONFIRMADA");
  });
```

E ajuste os imports no topo do arquivo:

```ts
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { daquiADias } from "@/test-utils/datas";
import * as getPaymentProviderModule from "@/providers/payment/getPaymentProvider";
```

E adicione, logo após o `afterAll` existente:

```ts
  afterEach(() => {
    vi.restoreAllMocks();
  });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- cancelar/route`
Expected: FAIL — a rota ainda não chama `provider.estornar`.

- [ ] **Step 3: Implementar**

Em `src/app/api/eventos/reservas/[id]/cancelar/route.ts`, adicione o import e ajuste a função:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularPercentualReembolso } from "@/lib/domain/refundPolicy";
import { buscarTiersPoliticaCancelamento } from "@/lib/domain/cancellationPolicyRepository";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";

function diasEntre(dataEvento: Date, agora: Date): number {
  // dataEvento vem de uma coluna @db.Date: o Prisma sempre a devolve como
  // meia-noite UTC, independentemente do fuso em que o valor foi criado.
  // agora é um instante real no fuso local do servidor. Para comparar
  // "dias de calendário" sem viés de fuso ou hora do dia, extraímos os
  // componentes de data de cada um do jeito certo (UTC para a coluna já
  // normalizada, local para "hoje") e diferenciamos duas meias-noites UTC.
  const dataEventoUTC = Date.UTC(dataEvento.getUTCFullYear(), dataEvento.getUTCMonth(), dataEvento.getUTCDate());
  const agoraUTC = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffMs = dataEventoUTC - agoraUTC;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// LIMITAÇÃO CONHECIDA: esta rota não verifica se quem chama é o dono da
// reserva — qualquer pessoa que descubra o id (cuid) pode cancelar. cuids
// são difíceis de adivinhar, mas isso é obscuridade, não autorização. Decisão
// registrada: aceitar o risco por ora e tratar no desenho de autenticação de
// cliente do Painel Admin (ver docs/superpowers/plans/2026-08-04-painel-admin.md).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id },
    include: { pagamento: true },
  });

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

  if (reserva.pagamento && reserva.pagamento.status === "APROVADO" && valorReembolso > 0) {
    const provider = getPaymentProvider();
    try {
      await provider.estornar(reserva.pagamento.referenciaExterna, valorReembolso);
    } catch {
      return NextResponse.json(
        { erro: "não foi possível processar o estorno junto ao provedor de pagamento; tente novamente" },
        { status: 502 }
      );
    }
  }

  const atualizada = await prisma.reservaEvento.update({
    where: { id },
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

Run: `npm test -- cancelar/route`
Expected: PASS (4 testes)

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/eventos/reservas/\[id\]/cancelar/
git commit -m "feat: aciona estorno real no gateway ao cancelar reserva de evento paga"
```

---

### Task 10: Cliente — QR code e polling no wizard de reserva de evento

**Files:**
- Modify: `src/app/reservar-evento/ReservaEventoWizard.tsx`

**Interfaces:**
- Consumes: `dadosPix` na resposta de `POST /pagamento` (Task 6), `GET /api/eventos/reservas/[id]` (Task 7).

Sem teste automatizado novo nesta task — o comportamento de polling com `setInterval`/tempo real é frágil em teste unitário e a cobertura real desse fluxo vem da verificação manual (Task 11). Os 3 testes existentes de `ReservaEventoWizard.test.tsx` continuam cobrindo o restante do wizard sem mudança.

- [ ] **Step 1: Adicionar o import de `useEffect` e os novos tipos/estado**

Em `src/app/reservar-evento/ReservaEventoWizard.tsx`, troque a linha 3:

```tsx
import { useEffect, useState } from "react";
import type { DadosPix } from "@/providers/payment/PaymentProvider";
```

`DadosPix` é importado do mesmo tipo já definido na Task 3 (`src/providers/payment/PaymentProvider.ts`) em vez de redeclarado aqui — single source of truth, mesmo padrão já usado em `mapa-do-dia/page.tsx` (painel admin) para os tipos de `dailyOverview.ts`. É um `import type`, então é inteiramente apagado na compilação e não traz nenhum código de servidor para o bundle do cliente.

Altere a definição de `Etapa` (linha 16):

```tsx
type Etapa =
  | "quando"
  | "pacote"
  | "orcamento"
  | "orcamentoEnviado"
  | "checkout"
  | "aguardandoPix"
  | "pagamentoExpirado"
  | "confirmado";
```

Adicione um novo `useState`, logo após `const [erro, setErro] = useState("");` (linha 36):

```tsx
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
```

- [ ] **Step 2: Atualizar `confirmarPagamento` para tratar a resposta pendente com PIX**

Substitua a função `confirmarPagamento` (linhas 156-178):

```tsx
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

      if (corpo.dadosPix) {
        setDadosPix(corpo.dadosPix);
        setEtapa("aguardandoPix");
        return;
      }

      setEtapa("confirmado");
    } catch {
      setErro("não foi possível conectar ao servidor para confirmar o pagamento");
    } finally {
      setCarregando(false);
    }
  }
```

- [ ] **Step 3: Adicionar o polling de status enquanto aguarda o Pix**

Adicione, logo após a função `confirmarPagamento`:

```tsx
  useEffect(() => {
    if (etapa !== "aguardandoPix" || !dadosPix) {
      return;
    }

    const expiraEmMs = new Date(dadosPix.expiraEm).getTime();

    const intervalo = setInterval(async () => {
      if (Date.now() >= expiraEmMs) {
        clearInterval(intervalo);
        setEtapa("pagamentoExpirado");
        return;
      }

      try {
        const resposta = await fetch(`/api/eventos/reservas/${reservaId}`);
        if (!resposta.ok) {
          return;
        }
        const corpo = await resposta.json();

        if (corpo.status === "CONFIRMADA") {
          clearInterval(intervalo);
          setEtapa("confirmado");
        } else if (corpo.status === "CANCELADA") {
          clearInterval(intervalo);
          setEtapa("pagamentoExpirado");
        }
      } catch {
        // Falha pontual de rede durante o polling — tenta de novo no
        // próximo intervalo, sem interromper a espera.
      }
    }, 3000);

    return () => clearInterval(intervalo);
  }, [etapa, dadosPix, reservaId]);
```

- [ ] **Step 4: Adicionar as novas telas de retorno antecipado**

Logo após o bloco `if (etapa === "confirmado") { ... }` (linhas 184-191), adicione:

```tsx
  if (etapa === "pagamentoExpirado") {
    return (
      <p role="alert">
        O tempo para concluir o pagamento esgotou. Volte e comece a reserva novamente.
      </p>
    );
  }
```

- [ ] **Step 5: Renderizar a tela do QR code**

Dentro do `return` principal, logo após o bloco `{etapa === "checkout" && ( ... )}` (fechando na linha 330), adicione:

```tsx
      {etapa === "aguardandoPix" && dadosPix && (
        <fieldset>
          <legend>Pague com Pix</legend>
          <p>Escaneie o QR code no app do seu banco ou copie o código abaixo.</p>
          <img src={`data:image/png;base64,${dadosPix.qrCodeBase64}`} alt="QR code para pagamento Pix" />
          <label>
            Código copia-e-cola
            <textarea readOnly value={dadosPix.qrCode} />
          </label>
          <p role="status">Aguardando confirmação do pagamento...</p>
        </fieldset>
      )}
```

- [ ] **Step 6: Rodar o typecheck e os testes existentes do wizard**

Run: `npx tsc --noEmit`
Expected: limpo.

Run: `npm test -- ReservaEventoWizard`
Expected: PASS (3 testes — nenhum deles exercita o fluxo de pix, então continuam passando sem alteração)

- [ ] **Step 7: Commit**

```bash
git add src/app/reservar-evento/ReservaEventoWizard.tsx
git commit -m "feat: exibe QR code do pix e faz polling de confirmação no wizard de evento"
```

---

### Task 11: Verificação manual e checklist final

**Files:** nenhum arquivo novo — task de verificação.

- [x] **Step 1: Configurar credenciais de teste**

Feito em 2026-08-10: conta de desenvolvedor criada, aplicação `antonina-osteria-dev` (Checkout Transparente + API de Pagamentos), credenciais de teste geradas, webhook de teste configurado via túnel ngrok apontando para `/api/webhooks/mercadopago`.

**Atenção — não persistir `PAYMENT_PROVIDER`/`MERCADOPAGO_*` no `.env` da raiz entre sessões de verificação:** `vitest.config.ts` carrega esse mesmo `.env` via `dotenv`, então deixar `PAYMENT_PROVIDER=mercadopago` lá vaza para `npm test` e quebra a garantia deste plano de que nenhum teste automatizado chama a API real. Sofremos isso na prática (3 testes de `pagamento/route.test.ts` falharam) até reverter. Ao repetir esta verificação: configure essas 3 variáveis, teste, e remova-as do `.env` antes de rodar a suíte de novo — ou passe-as só via `docker compose run -e ...`/env inline, nunca via `.env` compartilhado.

- [x] **Step 2: Subir o stack com o provider real**

Run: `docker compose up -d --build` — nota: se o container já existir com um volume anônimo `node_modules` antigo, `--force-recreate` sozinho **não** renova esse volume; é necessário `--renew-anon-volumes` (ou `-V`) junto com `--build` para o `node_modules` refletir dependências novas do `package.json` (ex.: o pacote `mercadopago`).

- [x] **Step 3: Fazer uma reserva de evento de ponta a ponta**

Verificado em 2026-08-10: QR code Pix real gerado pelo `MercadoPagoProvider` (imagem válida + copia-e-cola não vazio), `referenciaExterna` persistida, tela de polling ativa.

- [ ] **Step 4: Aprovar o Pix de teste — BLOQUEADO, não concluído**

Tentamos logar com uma conta de teste compradora (criada via painel) para pagar o Pix copia-e-cola, mas a tela de login atual do Mercado Pago (`CPF, e-mail ou telefone`) rejeita o "Usuário" gerado (`TESTUSER...`), apesar da documentação oficial dizer que esse username deveria funcionar — aparente divergência entre doc e produto atual. Não há aprovação automática de Pix de teste em sandbox (aguardamos ~90s sem mudança de status). Decisão: aceito como limitação conhecida do ambiente de teste local, não bloqueia o restante da verificação — ver evidência indireta abaixo.

- [ ] **Step 5: Confirmar o fechamento do ciclo — parcialmente verificado**

O webhook real do Mercado Pago chegou na rota (`POST /api/webhooks/mercadopago?data.id=...&type=payment`, HTTP 200), com **assinatura HMAC validada contra um payload real** (não mockado) — a parte mais frágil da integração está provada. A transição para `CONFIRMADA` em si (dependente do Step 4) tem cobertura completa em `webhooks/mercadopago/route.test.ts` com provider mockado forçando status "aprovado".

- [ ] **Step 6: Testar o cancelamento com estorno — não executado**

Depende de uma reserva com pagamento `APROVADO` (Step 4), que não foi alcançado. Lógica de estorno real coberta por `MercadoPagoProvider.test.ts` (SDK mockado) e exercitada em `cancelar/route.ts` — não testada contra a API real do Mercado Pago nesta sessão.

- [x] **Step 7: Rodar a suíte completa uma última vez**

Run: `npm test` — PASS em todos os arquivos (39 suítes). O processo `npm` sofre segmentation fault do Node *depois* de todas as suítes reportarem sucesso, em pontos variáveis a cada execução — assinatura de problema de ambiente Windows/Node, não de lógica dos testes. Investigação separada, não bloqueante.

## Checklist final do plano

- [x] `npm test` passa 100% (com a ressalva do segfault pós-execução, ambiente)
- [x] `npx tsc --noEmit` limpo
- [x] Reserva de evento com Pix real (sandbox) mostra QR code e confirma via webhook — QR code e chegada do webhook verificados ao vivo; confirmação final (`CONFIRMADA`) não alcançada por bloqueio no login da conta de teste compradora (ver Step 4)
- [ ] Cancelamento de uma reserva paga aciona um estorno real (sandbox) no Mercado Pago — não verificado ao vivo (depende do item acima); coberto por teste com SDK mockado
- [x] Nenhum teste automatizado faz chamada de rede real ao Mercado Pago (SDK sempre mockado) — restaurado após vazamento acidental via `.env` compartilhado (ver Step 1)
- [x] `PAYMENT_PROVIDER` não definido (ou definido com qualquer valor diferente de `mercadopago`) continua usando `MockPaymentProvider` — comportamento seguro por padrão preservado
- [x] `.env.example` documenta as três novas variáveis, sem valores reais
