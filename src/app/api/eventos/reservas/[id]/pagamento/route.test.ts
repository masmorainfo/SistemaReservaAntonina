import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { daquiADias } from "@/test-utils/datas";
import { MockPaymentProvider } from "@/providers/payment/MockPaymentProvider";
import * as getPaymentProviderModule from "@/providers/payment/getPaymentProvider";

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

  afterEach(() => {
    vi.restoreAllMocks();
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

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CONFIRMADA");
    expect(body.pagamento.status).toBe("APROVADO");
  });

  it("retorna 410 quando o hold já expirou", async () => {
    const reserva = await criarHold(daquiADias(31), new Date(Date.now() - 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(410);
  });

  it("exige ciência do direito de arrependimento para evento com menos de 7 dias", async () => {
    const reserva = await criarHold(daquiADias(3), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(400);
  });

  it("não exige ciência quando o evento está a exatos 7 dias de distância", async () => {
    const reserva = await criarHold(daquiADias(7), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(200);
  });

  it("exige ciência quando o evento está a exatos 6 dias de distância", async () => {
    const reserva = await criarHold(daquiADias(6), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(400);
  });

  it("aceita o pagamento com menos de 7 dias quando a ciência é confirmada", async () => {
    const reserva = await criarHold(daquiADias(4), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix", cienciaDireitoArrependimento: true }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(200);
  });

  it("retorna 400 com JSON malformado no corpo da requisição", async () => {
    const reserva = await criarHold(daquiADias(32), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: "isso não é JSON válido {",
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(400);
  });

  it("recusa o pagamento e cancela a reserva quando o provedor recusa", async () => {
    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue(
      new MockPaymentProvider("recusado")
    );

    const reserva = await criarHold(daquiADias(33), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagamento.status).toBe("RECUSADO");
    expect(body.reserva.status).toBe("CANCELADA");
  });

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

  it("repassa o e-mail real do cliente ao iniciar o pagamento", async () => {
    const iniciarPagamentoMock = vi.fn().mockResolvedValue({
      provedor: "fake-email",
      status: "aprovado" as const,
      referenciaExterna: "ref-email-123",
    });

    vi.spyOn(getPaymentProviderModule, "getPaymentProvider").mockReturnValue({
      nome: "fake-email",
      iniciarPagamento: iniciarPagamentoMock,
      validarWebhook: vi.fn(),
      consultarStatus: vi.fn(),
      estornar: vi.fn(),
    });

    const reserva = await criarHold(daquiADias(35), new Date(Date.now() + 10 * 60 * 1000));

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/pagamento`, {
      method: "POST",
      body: JSON.stringify({ metodo: "pix" }),
    });

    await POST(request, { params: Promise.resolve({ id: reserva.id }) });

    expect(iniciarPagamentoMock).toHaveBeenCalledWith(
      expect.objectContaining({ clienteEmail: "teste@exemplo.com" })
    );
  });
});
