import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago";
import type {
  PaymentProvider,
  IniciarPagamentoInput,
  ResultadoPagamento,
  ResultadoWebhook,
  ResultadoEstorno,
  StatusPagamentoResultado,
  PayloadWebhook,
} from "./PaymentProvider";
import { validarAssinaturaWebhook } from "./mercadoPagoSignature";

const QUINZE_MINUTOS_MS = 15 * 60 * 1000;

function mapearStatus(statusMp: string | undefined): StatusPagamentoResultado {
  if (statusMp === "approved") return "aprovado";
  if (statusMp === "rejected" || statusMp === "cancelled") return "recusado";
  return "pendente";
}

export class MercadoPagoProvider implements PaymentProvider {
  nome = "mercadopago";

  private client(): MercadoPagoConfig {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
    }
    return new MercadoPagoConfig({ accessToken });
  }

  async iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento> {
    if (input.valor <= 0) {
      throw new Error("valor do pagamento deve ser maior que zero");
    }
    if (input.metodo !== "pix") {
      throw new Error("MercadoPagoProvider só suporta pix nesta fase");
    }

    const payment = new Payment(this.client());
    const expiraEm = new Date(Date.now() + QUINZE_MINUTOS_MS).toISOString();

    const resultado = await payment.create({
      body: {
        transaction_amount: input.valor,
        payment_method_id: "pix",
        payer: { email: `reserva-${input.reservaEventoId}@antoninaosteria.com` },
        date_of_expiration: expiraEm,
        description: `Sinal de reserva de evento ${input.reservaEventoId}`,
      },
    });

    const qrCode = resultado.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = resultado.point_of_interaction?.transaction_data?.qr_code_base64;

    if (!qrCode || !qrCodeBase64 || resultado.id === undefined) {
      throw new Error("resposta inesperada do Mercado Pago ao criar o pagamento pix");
    }

    return {
      provedor: this.nome,
      status: "pendente",
      referenciaExterna: String(resultado.id),
      dadosPix: { qrCode, qrCodeBase64, expiraEm },
    };
  }

  async validarWebhook(payload: PayloadWebhook, assinatura: string): Promise<ResultadoWebhook> {
    const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!segredo) {
      throw new Error("MERCADOPAGO_WEBHOOK_SECRET não configurado");
    }

    const valida = validarAssinaturaWebhook({
      assinatura,
      requestId: payload.cabecalhoRequestId,
      dataId: payload.dataId,
      segredo,
    });

    if (!valida) {
      throw new Error("assinatura do webhook inválida");
    }

    // Nunca confia no status do corpo da notificação — rebusca pela API.
    const resultado = await this.consultarStatus(payload.dataId);

    return { referenciaExterna: payload.dataId, status: resultado.status };
  }

  async consultarStatus(referenciaExterna: string): Promise<ResultadoPagamento> {
    const payment = new Payment(this.client());
    const resultado = await payment.get({ id: referenciaExterna });

    return {
      provedor: this.nome,
      status: mapearStatus(resultado.status),
      referenciaExterna,
    };
  }

  async estornar(referenciaExterna: string, valor: number): Promise<ResultadoEstorno> {
    if (valor <= 0) {
      throw new Error("valor do estorno deve ser maior que zero");
    }

    const refund = new PaymentRefund(this.client());
    const resultado = await refund.create({
      payment_id: referenciaExterna,
      body: { amount: valor },
    });

    return {
      referenciaExterna,
      valorEstornado: valor,
      status: resultado.status === "approved" ? "aprovado" : "recusado",
    };
  }
}
