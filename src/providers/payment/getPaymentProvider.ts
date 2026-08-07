import type { PaymentProvider } from "./PaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";
import { MercadoPagoProvider } from "./MercadoPagoProvider";

/**
 * Fábrica do provedor de pagamento ativo. Sem PAYMENT_PROVIDER=mercadopago
 * definido, sempre retorna o MockPaymentProvider — inclusive no ambiente de
 * teste, que nunca define essa variável. Isso é intencional: o lado seguro
 * por padrão é nunca acidentalmente tentar falar com o Mercado Pago de
 * verdade sem configuração explícita.
 */
export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "mercadopago") {
    return new MercadoPagoProvider();
  }
  return new MockPaymentProvider();
}
