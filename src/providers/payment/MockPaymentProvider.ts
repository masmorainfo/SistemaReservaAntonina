import {
  PaymentProvider,
  IniciarPagamentoInput,
  ResultadoPagamento,
  ResultadoWebhook,
  ResultadoEstorno,
  PayloadWebhook,
} from "./PaymentProvider";

type ResultadoForcado = "aprovado" | "recusado";

function extrairReferencia(payload: PayloadWebhook): string {
  if (
    typeof payload.corpo === "object" &&
    payload.corpo !== null &&
    "referenciaExterna" in payload.corpo &&
    typeof (payload.corpo as { referenciaExterna: unknown }).referenciaExterna === "string"
  ) {
    return (payload.corpo as { referenciaExterna: string }).referenciaExterna;
  }

  return "mock_referencia_desconhecida";
}

export class MockPaymentProvider implements PaymentProvider {
  nome = "mock";

  /**
   * @param resultadoForcado força o desfecho das operações. Sem argumento, o
   * mock sempre aprova (comportamento padrão esperado pelos testes existentes).
   */
  constructor(private readonly resultadoForcado?: ResultadoForcado) {}

  private get resultado(): ResultadoForcado {
    return this.resultadoForcado ?? "aprovado";
  }

  async iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento> {
    if (input.valor <= 0) {
      throw new Error("valor do pagamento deve ser maior que zero");
    }

    return {
      provedor: this.nome,
      status: this.resultado,
      referenciaExterna: `mock_${input.reservaEventoId}_${Date.now()}`,
    };
  }

  async validarWebhook(payload: PayloadWebhook, _assinatura: string): Promise<ResultadoWebhook> {
    // A validação real de assinatura é responsabilidade do gateway real (Fase 2).
    return {
      referenciaExterna: extrairReferencia(payload),
      status: this.resultado,
    };
  }

  async consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento> {
    return {
      provedor: this.nome,
      status: this.resultado,
      referenciaExterna,
    };
  }

  async estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno> {
    if (valor <= 0) {
      throw new Error("valor do estorno deve ser maior que zero");
    }

    return {
      referenciaExterna,
      valorEstornado: valor,
      status: this.resultado,
    };
  }
}
