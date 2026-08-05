import { $Enums } from "@prisma/client";
import type { MetodoPagamento, StatusPagamentoResultado } from "./PaymentProvider";

/**
 * Ponte entre as strings minúsculas usadas pelos provedores de pagamento e os
 * enums em maiúsculas do schema Prisma. Único lugar onde essa conversão existe.
 */

const METODO_PARA_ENUM: Record<MetodoPagamento, $Enums.MetodoPagamentoEnum> = {
  pix: $Enums.MetodoPagamentoEnum.PIX,
  cartao: $Enums.MetodoPagamentoEnum.CARTAO,
};

const STATUS_PARA_ENUM: Record<StatusPagamentoResultado, $Enums.StatusPagamento> = {
  aprovado: $Enums.StatusPagamento.APROVADO,
  recusado: $Enums.StatusPagamento.RECUSADO,
  pendente: $Enums.StatusPagamento.PENDENTE,
};

export function paraMetodoPagamentoEnum(metodo: MetodoPagamento): $Enums.MetodoPagamentoEnum {
  return METODO_PARA_ENUM[metodo];
}

export function paraStatusPagamentoEnum(
  status: StatusPagamentoResultado
): $Enums.StatusPagamento {
  return STATUS_PARA_ENUM[status];
}
