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
        clienteEmail: "cliente@exemplo.com",
      });

      expect(resultado.status).toBe("pendente");
      expect(resultado.provedor).toBe("mercadopago");
      expect(resultado.referenciaExterna).toBe("123456789");
      expect(resultado.dadosPix?.qrCode).toBe("00020126...codigo-copia-e-cola");
      expect(resultado.dadosPix?.qrCodeBase64).toBe("aGVsbG8=");
      expect(resultado.dadosPix?.expiraEm).toBeTruthy();
    });

    it("usa o e-mail real do cliente no pagamento, não um e-mail sintético", async () => {
      paymentCreateMock.mockResolvedValueOnce({
        id: 1,
        status: "pending",
        point_of_interaction: {
          transaction_data: { qr_code: "codigo", qr_code_base64: "base64" },
        },
      });

      const provider = new MercadoPagoProvider();
      await provider.iniciarPagamento({
        reservaEventoId: "evt_1",
        valor: 100,
        metodo: "pix",
        clienteEmail: "cliente-de-verdade@exemplo.com",
      });

      expect(paymentCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ payer: { email: "cliente-de-verdade@exemplo.com" } }),
        })
      );
    });

    it("lança erro para valor zero ou negativo", async () => {
      const provider = new MercadoPagoProvider();
      await expect(
        provider.iniciarPagamento({
          reservaEventoId: "evt_1",
          valor: 0,
          metodo: "pix",
          clienteEmail: "cliente@exemplo.com",
        })
      ).rejects.toThrow();
      expect(paymentCreateMock).not.toHaveBeenCalled();
    });

    it("lança erro para método diferente de pix", async () => {
      const provider = new MercadoPagoProvider();
      await expect(
        provider.iniciarPagamento({
          reservaEventoId: "evt_1",
          valor: 100,
          metodo: "cartao",
          clienteEmail: "cliente@exemplo.com",
        })
      ).rejects.toThrow();
      expect(paymentCreateMock).not.toHaveBeenCalled();
    });

    it("lança erro quando a resposta do Mercado Pago vem sem os dados do QR code", async () => {
      paymentCreateMock.mockResolvedValueOnce({ id: 1, status: "pending" });

      const provider = new MercadoPagoProvider();
      await expect(
        provider.iniciarPagamento({
          reservaEventoId: "evt_1",
          valor: 100,
          metodo: "pix",
          clienteEmail: "cliente@exemplo.com",
        })
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
