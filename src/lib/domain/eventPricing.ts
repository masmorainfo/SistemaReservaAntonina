export interface CalculoValorEventoInput {
  precoPessoa: number;
  numConvidados: number;
  taxaServicoPct: number;
  equipamentoTelao: boolean;
}

export const VALOR_TELAO_PROJETOR = 500;

export function calcularValorTotalEvento(input: CalculoValorEventoInput): number {
  const { precoPessoa, numConvidados, taxaServicoPct, equipamentoTelao } = input;

  if (numConvidados <= 0) {
    throw new Error("numConvidados deve ser maior que zero");
  }

  const subtotalPratos = precoPessoa * numConvidados;
  const totalComTaxa = subtotalPratos * (1 + taxaServicoPct / 100);
  const totalComEquipamento = totalComTaxa + (equipamentoTelao ? VALOR_TELAO_PROJETOR : 0);

  return Math.round(totalComEquipamento * 100) / 100;
}
