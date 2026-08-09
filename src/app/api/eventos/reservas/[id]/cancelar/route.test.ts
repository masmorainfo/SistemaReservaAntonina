import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { daquiADias } from "@/test-utils/datas";
import * as getPaymentProviderModule from "@/providers/payment/getPaymentProvider";

describe("POST /api/eventos/reservas/[id]/cancelar", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Cancelamento", precoPessoa: 100, taxaServicoPct: 10 },
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
    // percentualSinal não foi informado (default 100), então o sinal pago
    // equivale ao valorTotal — o Pagamento abaixo reflete isso.
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mock",
        metodo: "PIX",
        valor: 1100,
        status: "APROVADO",
        referenciaExterna: "ref-cancelamento-base",
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
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

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(409);
  });

  it("chama o estorno do provedor quando existe um pagamento aprovado", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Com Pagamento",
        clienteTelefone: "+5541999999999",
        clienteEmail: "pagou@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(21),
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

  it("calcula o estorno com base no valor pago (sinal parcial), não no valorTotal do evento", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Sinal Parcial",
        clienteTelefone: "+5541999999999",
        clienteEmail: "sinal-parcial@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(23),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        percentualSinal: 50,
        status: "CONFIRMADA",
      },
    });
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mercadopago",
        metodo: "PIX",
        valor: 550,
        status: "APROVADO",
        referenciaExterna: "ref-cancelamento-sinal-parcial",
      },
    });

    const estornarMock = vi.fn().mockResolvedValue({
      referenciaExterna: "ref-cancelamento-sinal-parcial",
      valorEstornado: 550,
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
    expect(body.reserva.percentualReembolsoAplicado).toBe("100");
    expect(body.reserva.valorReembolso).toBe("550");
    expect(estornarMock).toHaveBeenCalledWith("ref-cancelamento-sinal-parcial", 550);
  });

  it("não cancela a reserva quando o estorno falha", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Estorno Falho",
        clienteTelefone: "+5541999999999",
        clienteEmail: "falhou@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(22),
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
});
