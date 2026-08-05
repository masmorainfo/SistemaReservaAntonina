import { describe, it, expect } from "vitest";
import { calcularPercentualReembolso } from "./refundPolicy";

describe("calcularPercentualReembolso", () => {
  it.each([
    [20, 100],
    [15, 100],
    [14, 75],
    [8, 75],
    [7, 50],
    [4, 50],
    [3, 25],
    [2, 25],
    [1, 0],
    [0, 0],
  ])("com %i dias de antecedência retorna %i%% de reembolso", (dias, esperado) => {
    expect(calcularPercentualReembolso(dias)).toBe(esperado);
  });

  it("lança erro para número de dias negativo", () => {
    expect(() => calcularPercentualReembolso(-1)).toThrow();
  });
});
