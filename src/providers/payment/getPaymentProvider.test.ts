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
