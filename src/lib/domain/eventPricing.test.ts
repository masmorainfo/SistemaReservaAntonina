import { describe, it, expect } from "vitest";
import { calcularValorTotalEvento } from "./eventPricing";

describe("calcularValorTotalEvento", () => {
  it("calcula pacote Clássico para 10 pessoas com taxa de 10%", () => {
    const total = calcularValorTotalEvento({
      precoPessoa: 197,
      numConvidados: 10,
      taxaServicoPct: 10,
      equipamentoTelao: false,
    });
    expect(total).toBe(2167.0);
  });

  it("soma o valor do telão quando selecionado", () => {
    const total = calcularValorTotalEvento({
      precoPessoa: 197,
      numConvidados: 10,
      taxaServicoPct: 10,
      equipamentoTelao: true,
    });
    expect(total).toBe(2667.0);
  });

  it("arredonda para duas casas decimais", () => {
    const total = calcularValorTotalEvento({
      precoPessoa: 33.33,
      numConvidados: 3,
      taxaServicoPct: 10,
      equipamentoTelao: false,
    });
    expect(total).toBe(109.99);
  });

  it("lança erro se número de convidados for zero ou negativo", () => {
    expect(() =>
      calcularValorTotalEvento({
        precoPessoa: 197,
        numConvidados: 0,
        taxaServicoPct: 10,
        equipamentoTelao: false,
      })
    ).toThrow();
  });
});
