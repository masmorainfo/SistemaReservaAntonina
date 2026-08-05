import { describe, it, expect } from "vitest";
import { classificarMesasPorCapacidade, selecionarMesasParaExibir } from "./tableFit";

describe("classificarMesasPorCapacidade", () => {
  it("classifica mesa dentro da tolerância como ideal", () => {
    const mesas = [{ id: "1", capacidadeLugares: 4 }];
    expect(classificarMesasPorCapacidade(mesas, 2)).toEqual([
      { id: "1", capacidadeLugares: 4, faixa: "ideal" },
    ]);
  });

  it("classifica mesa muito maior que o grupo como alternativa", () => {
    const mesas = [{ id: "1", capacidadeLugares: 12 }];
    expect(classificarMesasPorCapacidade(mesas, 2)).toEqual([
      { id: "1", capacidadeLugares: 12, faixa: "alternativa" },
    ]);
  });

  it("exclui mesas menores que o grupo", () => {
    const mesas = [{ id: "1", capacidadeLugares: 2 }];
    expect(classificarMesasPorCapacidade(mesas, 4)).toEqual([]);
  });
});

describe("selecionarMesasParaExibir", () => {
  it("retorna só mesas ideais quando existem", () => {
    const mesas = [
      { id: "1", capacidadeLugares: 4 },
      { id: "2", capacidadeLugares: 12 },
    ];
    expect(selecionarMesasParaExibir(mesas, 2)).toEqual([
      { id: "1", capacidadeLugares: 4, faixa: "ideal" },
    ]);
  });

  it("libera mesas alternativas quando não há mesa ideal disponível", () => {
    const mesas = [{ id: "2", capacidadeLugares: 12 }];
    expect(selecionarMesasParaExibir(mesas, 2)).toEqual([
      { id: "2", capacidadeLugares: 12, faixa: "alternativa" },
    ]);
  });
});
