export type MetodoPagamento = "pix" | "cartao";

export type StatusPagamentoResultado = "aprovado" | "recusado" | "pendente";

export interface IniciarPagamentoInput {
  reservaEventoId: string;
  valor: number;
  metodo: MetodoPagamento;
}

export interface ResultadoPagamento {
  provedor: string;
  status: StatusPagamentoResultado;
  referenciaExterna: string;
}

/** Resultado da validação de um webhook do gateway de pagamento. */
export interface ResultadoWebhook {
  referenciaExterna: string;
  status: StatusPagamentoResultado;
}

/** Resultado de um pedido de estorno junto ao gateway. */
export interface ResultadoEstorno {
  referenciaExterna: string;
  valorEstornado: number;
  status: "aprovado" | "recusado";
}

export interface PaymentProvider {
  nome: string;

  /**
   * Inicia uma tentativa de pagamento. NÃO confirma a reserva — a confirmação
   * só acontece após a validação do webhook do gateway.
   */
  iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento>;

  /** Valida a assinatura e o corpo de um webhook recebido do gateway. */
  validarWebhook(payload: unknown, assinatura: string): Promise<ResultadoWebhook>;

  /** Consulta o status atual de um pagamento no gateway. */
  consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento>;

  /** Solicita o estorno (total ou parcial) de um pagamento aprovado. */
  estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno>;
}
