import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { paraNumero, paraDecimal } from "./money";

describe("paraNumero", () => {
  it("converte um Decimal do Prisma para number", () => {
    expect(paraNumero(new Prisma.Decimal("2167.00"))).toBe(2167);
    expect(paraNumero(new Prisma.Decimal("10.50"))).toBe(10.5);
  });

  it("devolve o próprio valor quando já é number", () => {
    expect(paraNumero(197)).toBe(197);
    expect(paraNumero(0)).toBe(0);
  });
});

describe("paraDecimal", () => {
  it("converte um number para Decimal preservando o valor", () => {
    expect(paraDecimal(197.5).toNumber()).toBe(197.5);
    expect(paraDecimal(0).toString()).toBe("0");
  });
});
