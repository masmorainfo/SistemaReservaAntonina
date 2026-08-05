import { describe, it, expect } from "vitest";
import { verificarPermissao, AcessoNegadoError } from "./roles";

describe("verificarPermissao", () => {
  it("permite quando o perfil está na lista de permitidos", () => {
    expect(() => verificarPermissao("DONO", ["DONO"])).not.toThrow();
  });

  it("permite Recepção quando Recepção está entre os permitidos", () => {
    expect(() => verificarPermissao("RECEPCAO", ["DONO", "RECEPCAO"])).not.toThrow();
  });

  it("nega Recepção quando só Dono é permitido", () => {
    expect(() => verificarPermissao("RECEPCAO", ["DONO"])).toThrow(AcessoNegadoError);
  });
});
