import { describe, it, expect } from "vitest";
import { FallbackMapProvider } from "./FallbackMapProvider";

describe("FallbackMapProvider", () => {
  const zonas = {
    ambiente_deck: [
      { mesaId: "mesa_1", numero: "D01", coordenadas: { x: 10, y: 20, largura: 50, altura: 50 } },
    ],
  };

  it("retorna as zonas clicáveis cadastradas para o ambiente", async () => {
    const provider = new FallbackMapProvider(zonas);
    const resultado = await provider.obterZonasClicaveis("ambiente_deck");
    expect(resultado).toEqual(zonas.ambiente_deck);
  });

  it("retorna lista vazia para ambiente sem zonas cadastradas", async () => {
    const provider = new FallbackMapProvider(zonas);
    const resultado = await provider.obterZonasClicaveis("ambiente_inexistente");
    expect(resultado).toEqual([]);
  });
});
