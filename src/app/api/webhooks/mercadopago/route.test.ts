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
