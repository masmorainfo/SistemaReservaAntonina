import { createHmac, timingSafeEqual } from "node:crypto";

export interface ParametrosAssinatura {
  /** Valor bruto do header x-signature (formato "ts=...,v1=..."). */
  assinatura: string;
  /** Valor do header x-request-id. */
  requestId: string;
  /** ID do pagamento (data.id da query string da notificação). */
  dataId: string;
  /** MERCADOPAGO_WEBHOOK_SECRET configurado no painel do Mercado Pago. */
  segredo: string;
}

function extrairPartesAssinatura(assinatura: string): { ts: string; v1: string } | null {
  const partes: Record<string, string> = {};

  for (const par of assinatura.split(",")) {
    const [chave, valor] = par.split("=");
    if (chave && valor) {
      partes[chave.trim()] = valor.trim();
    }
  }

  if (!partes.ts || !partes.v1) {
    return null;
  }

  return { ts: partes.ts, v1: partes.v1 };
}

/**
 * Reproduz o algoritmo de validação de assinatura documentado pelo Mercado
 * Pago: monta o manifest "id:{dataId};request-id:{requestId};ts:{ts};",
 * calcula o HMAC-SHA256 com o segredo do webhook, e compara com o valor v1
 * recebido no header x-signature.
 */
export function validarAssinaturaWebhook(params: ParametrosAssinatura): boolean {
  const partes = extrairPartesAssinatura(params.assinatura);
  if (!partes) {
    return false;
  }

  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${partes.ts};`;
  const hashEsperado = createHmac("sha256", params.segredo).update(manifest).digest("hex");
  const bufferEsperado = Buffer.from(hashEsperado, "hex");
  const bufferRecebido = Buffer.from(partes.v1, "hex");

  if (bufferEsperado.length !== bufferRecebido.length) {
    return false;
  }

  return timingSafeEqual(bufferEsperado, bufferRecebido);
}
