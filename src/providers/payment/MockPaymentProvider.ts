import { PaymentProvider, IniciarPagamentoInput, ResultadoPagamento } from "./PaymentProvider";

export class MockPaymentProvider implements PaymentProvider {
  nome = "mock";

  async iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento> {
    if (input.valor <= 0) {
      throw new Error("valor do pagamento deve ser maior que zero");
    }

    return {
      provedor: this.nome,
      status: "aprovado",
      referenciaExterna: `mock_${input.reservaEventoId}_${Date.now()}`,
    };
  }
}
