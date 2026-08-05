import { describe, it, expect } from "vitest";
import { hashSenha, verificarSenha } from "./password";

describe("hashSenha / verificarSenha", () => {
  it("gera hash diferente do texto original", async () => {
    const hash = await hashSenha("minhasenha123");
    expect(hash).not.toBe("minhasenha123");
  });

  it("verifica senha correta como válida", async () => {
    const hash = await hashSenha("minhasenha123");
    expect(await verificarSenha("minhasenha123", hash)).toBe(true);
  });

  it("rejeita senha incorreta", async () => {
    const hash = await hashSenha("minhasenha123");
    expect(await verificarSenha("senhaerrada", hash)).toBe(false);
  });
});
