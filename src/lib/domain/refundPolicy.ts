export interface PoliticaCancelamentoTier {
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: number;
}

export const POLITICA_CANCELAMENTO_PADRAO: PoliticaCancelamentoTier[] = [
  { diasMinimos: 15, diasMaximos: null, percentualReembolso: 100 },
  { diasMinimos: 8, diasMaximos: 14, percentualReembolso: 75 },
  { diasMinimos: 4, diasMaximos: 7, percentualReembolso: 50 },
  { diasMinimos: 2, diasMaximos: 3, percentualReembolso: 25 },
  { diasMinimos: 0, diasMaximos: 1, percentualReembolso: 0 },
];

export function calcularPercentualReembolso(
  diasAteEvento: number,
  tiers: PoliticaCancelamentoTier[] = POLITICA_CANCELAMENTO_PADRAO
): number {
  if (diasAteEvento < 0) {
    throw new Error("diasAteEvento não pode ser negativo");
  }

  const tier = tiers.find((t) =>
    t.diasMaximos === null
      ? diasAteEvento >= t.diasMinimos
      : diasAteEvento >= t.diasMinimos && diasAteEvento <= t.diasMaximos
  );

  if (!tier) {
    throw new Error(`Nenhuma faixa de política de cancelamento cobre ${diasAteEvento} dias`);
  }

  return tier.percentualReembolso;
}
