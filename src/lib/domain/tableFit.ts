export const TOLERANCIA_LUGARES_EXTRAS = 2;

export interface MesaCandidata {
  id: string;
  capacidadeLugares: number;
}

export interface MesaClassificada extends MesaCandidata {
  faixa: "ideal" | "alternativa" | "ocupada";
}

export function classificarMesasPorCapacidade(
  mesas: MesaCandidata[],
  numPessoas: number
): MesaClassificada[] {
  return mesas
    .filter((mesa) => mesa.capacidadeLugares >= numPessoas)
    .map((mesa) => ({
      ...mesa,
      faixa: (mesa.capacidadeLugares <= numPessoas + TOLERANCIA_LUGARES_EXTRAS
        ? "ideal"
        : "alternativa") as "ideal" | "alternativa",
    }))
    .sort((a, b) => a.capacidadeLugares - b.capacidadeLugares);
}

export function selecionarMesasParaExibir(
  mesas: MesaCandidata[],
  numPessoas: number
): MesaClassificada[] {
  const classificadas = classificarMesasPorCapacidade(mesas, numPessoas);
  const ideais = classificadas.filter((mesa) => mesa.faixa === "ideal");
  return ideais.length > 0 ? ideais : classificadas;
}
