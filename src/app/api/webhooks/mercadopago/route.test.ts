import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { daquiADias } from "@/test-utils/datas";
import * as getPaymentProviderModule from "@/providers/payment/getPaymentProvider";
import type { StatusPagamentoResultado, ResultadoEstorno, PaymentProvider } from "@/providers/payment/PaymentProvider";
import { POST } from "./route";

function fazerRequest(dataId: string, assinatura = "assinatura-qualquer") {
  return new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}`, {
    method: "POST",
    headers: { "x-signature": assinatura, "x-request-id": "req-1" },
    body: JSON.stringify({ action: "payment.updated", data: { id: dataId } }),
  });
}

function providerFake(overrides: {
  validarWebhook: (payload: unknown, assinatura: string) => Promise<{ referenciaExterna: string; status: StatusPagamentoResultado }>;
  estornar?: ReturnType<typeof vi.fn>;
}): PaymentProvider {
  return {
    nome: "mercadopago",
    iniciarPagamento: vi.fn(),
    validarWebhook: overrides.validarWebhook,
    consultarStatus: vi.fn(),
    estornar: (overrides.estornar ?? vi.fn().mockResolvedValue({ referenciaExterna: "x", valorEstornado: 0, status: "aprovado" })) as (referenciaExterna: string, valor: number) => Promise<ResultadoEstorno>,
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

  // reserva_evento_unica_ativa_por_dia (migration 20260806035505) permite no
  // máximo uma reserva AGUARDANDO_PAGAMENTO ou CONFIRMADA por dia — cada
  // chamada que cria uma reserva ativa nesse sentido precisa de uma data
  // própria; reservas CANCELADA ficam fora do índice e podem compartilhar.
  async function criarReservaComPagamento(status: "AGUARDANDO_PAGAMENTO" | "CONFIRMADA" | "CANCELADA", referenciaExterna: string, statusPagamento: "PENDENTE" | "APROVADO" | "RECUSADO" = "PENDENTE", diasEvento = 40) {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Webhook",
        clienteTelefone: "+5541999999999",
        clienteEmail: "webhook@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(diasEvento),
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
    const reserva = await criarReservaComPagamento("AGUARDANDO_PAGAMENTO", "ref-recusado-1", "PENDENTE", 41);
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
    const reserva = await criarReservaComPagamento("CONFIRMADA", "ref-duplicado-1", "APROVADO", 42);
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
    expect(Number(reservaAposWebhook?.valorReembolso)).toBe(2200);
    expect(Number(reservaAposWebhook?.percentualReembolsoAplicado)).toBe(100);
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

  it("retorna 200 sem sobrescrever quando a reserva saiu de AGUARDANDO_PAGAMENTO entre a leitura e a transação do webhook (corrida)", async () => {
    const reserva = await criarReservaComPagamento("AGUARDANDO_PAGAMENTO", "ref-corrida-1", "PENDENTE", 43);

    // Simula a corrida descrita no fix: no momento em que a transação desta
    // requisição roda, a reserva já foi liberada no banco de verdade (ex.:
    // por liberarHoldsExpirados ou por outra entrega concorrente do mesmo
    // webhook) — mas a leitura que esta requisição fez enxergou o snapshot
    // anterior (AGUARDANDO_PAGAMENTO). Reproduzido interceptando essa leitura
    // para retornar o snapshot antigo, enquanto o banco real já está CANCELADA.
    //
    // Nota: usamos substituição direta da propriedade (em vez de
    // vi.spyOn(...).mockRestore()) porque, neste ambiente, restaurar um spy
    // sobre um método do model delegate do Prisma o deixa `undefined`
    // permanentemente — quebrando todos os testes seguintes deste arquivo.
    await prisma.reservaEvento.update({
      where: { id: reserva.id },
      data: { status: "CANCELADA", holdExpiresAt: null },
    });

    const originalFindUnique = prisma.reservaEvento.findUnique.bind(prisma.reservaEvento);
    let chamadas = 0;
    prisma.reservaEvento.findUnique = ((...args: unknown[]) => {
      chamadas += 1;
      if (chamadas === 1) {
        return Promise.resolve({ ...reserva });
      }
      return (originalFindUnique as (...a: unknown[]) => unknown)(...args);
    }) as unknown as typeof prisma.reservaEvento.findUnique;

    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({ validarWebhook: async () => ({ referenciaExterna: "ref-corrida-1", status: "aprovado" }) })
    );

    try {
      const response = await POST(fazerRequest("ref-corrida-1"));
      expect(response.status).toBe(200);
    } finally {
      prisma.reservaEvento.findUnique = originalFindUnique;
    }

    const reservaFinal = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaFinal?.status).toBe("CANCELADA");
  });

  it("retorna 200 (não 500) quando a transação de confirmação falha com P2002 (conflito de data)", async () => {
    const reserva = await criarReservaComPagamento("AGUARDANDO_PAGAMENTO", "ref-p2002-1", "PENDENTE", 44);

    // Simula o conflito de data descrito no fix (outra reserva ocupou a
    // mesma data entre a leitura e a transação, violando
    // reserva_evento_unica_ativa_por_dia): rejeitamos a própria chamada de
    // $transaction com o erro que o Postgres/Prisma produziriam nesse caso,
    // exercitando o catch de P2002 diretamente. Substituição direta da
    // propriedade pelo mesmo motivo explicado no teste acima.
    const originalTransaction = prisma.$transaction.bind(prisma);
    let chamadas = 0;
    prisma.$transaction = ((...args: unknown[]) => {
      chamadas += 1;
      if (chamadas === 1) {
        return Promise.reject(
          new Prisma.PrismaClientKnownRequestError("conflito de unicidade em reserva_evento_unica_ativa_por_dia", {
            code: "P2002",
            clientVersion: "test",
          })
        );
      }
      return (originalTransaction as (...a: unknown[]) => unknown)(...args);
    }) as unknown as typeof prisma.$transaction;

    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      providerFake({ validarWebhook: async () => ({ referenciaExterna: "ref-p2002-1", status: "aprovado" }) })
    );

    try {
      const response = await POST(fazerRequest("ref-p2002-1"));
      expect(response.status).toBe(200);
    } finally {
      prisma.$transaction = originalTransaction;
    }

    const reservaFinal = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(reservaFinal?.status).toBe("AGUARDANDO_PAGAMENTO");
  });
});
