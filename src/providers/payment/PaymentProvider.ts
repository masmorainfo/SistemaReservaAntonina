export type MetodoPagamento = "pix" | "cartao";

export type StatusPagamentoResultado = "aprovado" | "recusado" | "pendente";

export interface IniciarPagamentoInput {
  reservaEventoId: string;
  valor: number;
  metodo: MetodoPagamento;
}

export interface DadosPix {
  /** Código copia-e-cola. */
  qrCode: string;
  /** Imagem do QR code em base64, pronta para <img src="data:image/png;base64,...">. */
  qrCodeBase64: string;
  /** ISO 8601 — mesmo instante do holdExpiresAt da reserva. */
  expiraEm: string;
}

export interface ResultadoPagamento {
  provedor: string;
  status: StatusPagamentoResultado;
  referenciaExterna: string;
  /** Só preenchido quando o método é pix e o pagamento ainda está pendente. */
  dadosPix?: DadosPix;
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

/**
 * Dados brutos de uma requisição de webhook, na forma que qualquer provider
 * precisa para validar a origem da notificação e localizar o pagamento.
 */
export interface PayloadWebhook {
  /** Corpo (JSON já parseado) da notificação recebida. */
  corpo: unknown;
  /** Header x-request-id (ou equivalente do provider), usado na assinatura. */
  cabecalhoRequestId: string;
  /** Identificador do pagamento no gateway (ex.: data.id da query string). */
  dataId: string;
}

export interface PaymentProvider {
  nome: string;

  /**
   * Inicia uma tentativa de pagamento. NÃO confirma a reserva — a confirmação
   * só acontece após a validação do webhook do gateway.
   */
  iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento>;

  /** Valida a assinatura e o corpo de um webhook recebido do gateway. */
  validarWebhook(payload: PayloadWebhook, assinatura: string): Promise<ResultadoWebhook>;

  /** Consulta o status atual de um pagamento no gateway. */
  consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento>;

  /** Solicita o estorno (total ou parcial) de um pagamento aprovado. */
  estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno>;
}
