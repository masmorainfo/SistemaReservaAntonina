import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPaymentProvider } from "./getPaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";

describe("getPaymentProvider", () => {
  const envOriginal = process.env.PAYMENT_PROVIDER;

  afterEach(() => {
    process.env.PAYMENT_PROVIDER = envOriginal;
  });

  it("retorna MockPaymentProvider por padrão quando PAYMENT_PROVIDER não está setado", () => {
    delete process.env.PAYMENT_PROVIDER;
    const provider = getPaymentProvider();
    expect(provider).toBeInstanceOf(MockPaymentProvider);
  });

  it("retorna MercadoPagoProvider quando PAYMENT_PROVIDER === 'mercadopago'", () => {
    process.env.PAYMENT_PROVIDER = "mercadopago";
    const provider = getPaymentProvider();
    expect(provider).toBeInstanceOf(MercadoPagoProvider);
  });
});
