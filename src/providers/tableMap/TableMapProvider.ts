export interface ZonaClicavel {
  mesaId: string;
  numero: string;
  coordenadas: { x: number; y: number; largura: number; altura: number };
}

export interface TableMapProvider {
  nome: string;
  obterZonasClicaveis(ambienteId: string): Promise<ZonaClicavel[]>;
}
