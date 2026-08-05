import { TableMapProvider, ZonaClicavel } from "./TableMapProvider";

export class FallbackMapProvider implements TableMapProvider {
  nome = "fallback";

  constructor(private readonly zonasPorAmbiente: Record<string, ZonaClicavel[]>) {}

  async obterZonasClicaveis(ambienteId: string): Promise<ZonaClicavel[]> {
    return this.zonasPorAmbiente[ambienteId] ?? [];
  }
}
