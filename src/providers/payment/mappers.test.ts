import { describe, it, expect } from "vitest";
import { paraMetodoPagamentoEnum, paraStatusPagamentoEnum } from "./mappers";

describe("paraMetodoPagamentoEnum", () => {
  it("mapeia os métodos do provedor para o enum do Prisma", () => {
    expect(paraMetodoPagamentoEnum("pix")).toBe("PIX");
    expect(paraMetodoPagamentoEnum("cartao")).toBe("CARTAO");
  });
});

describe("paraStatusPagamentoEnum", () => {
  it("mapeia os status do provedor para o enum do Prisma", () => {
    expect(paraStatusPagamentoEnum("aprovado")).toBe("APROVADO");
    expect(paraStatusPagamentoEnum("recusado")).toBe("RECUSADO");
    expect(paraStatusPagamentoEnum("pendente")).toBe("PENDENTE");
  });
});
