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

  it("consulta status devolvendo a mesma referência externa", async () => {
    const provider = new MockPaymentProvider();
    const resultado = await provider.consultarStatus("mock_evt_1_123");

    expect(resultado).toEqual({
      provedor: "mock",
      status: "aprovado",
      referenciaExterna: "mock_evt_1_123",
    });
  });

  it("estorna devolvendo o valor solicitado", async () => {
    const provider = new MockPaymentProvider();
    const resultado = await provider.estornar("mock_evt_1_123", 250.5);

    expect(resultado).toEqual({
      referenciaExterna: "mock_evt_1_123",
      valorEstornado: 250.5,
      status: "aprovado",
    });
  });

  it("lança erro ao estornar valor zero ou negativo", async () => {
    const provider = new MockPaymentProvider();
    await expect(provider.estornar("mock_evt_1_123", 0)).rejects.toThrow();
  });

  describe("com resultado forçado 'recusado'", () => {
    it("recusa o pagamento iniciado", async () => {
      const provider = new MockPaymentProvider("recusado");
      const resultado = await provider.iniciarPagamento({
        reservaEventoId: "evt_1",
        valor: 100,
        metodo: "cartao",
      });

      expect(resultado.status).toBe("recusado");
    });

    it("recusa também webhook, consulta e estorno", async () => {
      const provider = new MockPaymentProvider("recusado");

      expect(
        (await provider.validarWebhook({ corpo: {}, cabecalhoRequestId: "", dataId: "" }, "assinatura")).status
      ).toBe("recusado");
      expect((await provider.consultarStatus("ref")).status).toBe("recusado");
      expect((await provider.estornar("ref", 10)).status).toBe("recusado");
    });
  });
});
