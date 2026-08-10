import type { PaymentProvider } from "./PaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";

/**
 * Fábrica do provedor de pagamento ativo. Por padrão retorna o MockPaymentProvider;
 * retorna MercadoPagoProvider quando a variável de ambiente PAYMENT_PROVIDER="mercadopago".
 */
export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "mercadopago") {
    return new MercadoPagoProvider();
  }
  return new MockPaymentProvider();
}
