import type { PaymentProvider } from "./PaymentProvider";
import { MockPaymentProvider } from "./MockPaymentProvider";

/**
 * Fábrica do provedor de pagamento ativo. Hoje sempre retorna o
 * MockPaymentProvider — este é o ponto de extensão onde um gateway real
 * (Fase 2) será plugado, e o que torna a escolha de provedor testável/mockável
 * a partir das rotas que o consomem.
 */
export function getPaymentProvider(): PaymentProvider {
  return new MockPaymentProvider();
}
