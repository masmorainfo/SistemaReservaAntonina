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
