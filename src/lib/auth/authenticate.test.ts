import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashSenha } from "./password";
import { autenticarAdmin } from "./authenticate";

describe("autenticarAdmin", () => {
  const email = "teste.fundacao@antoninaosteria.com";
  const senha = "senhaDeTeste123";

  beforeAll(async () => {
    await prisma.adminUser.create({
      data: {
        nome: "Usuário de Teste",
        email,
        senhaHash: await hashSenha(senha),
        role: "DONO",
      },
    });
  });

  afterAll(async () => {
    await prisma.adminUser.delete({ where: { email } });
  });

  it("retorna dados da sessão com credenciais corretas", async () => {
    const resultado = await autenticarAdmin(email, senha);
    expect(resultado).toMatchObject({ email, role: "DONO" });
  });

  it("retorna null com senha incorreta", async () => {
    expect(await autenticarAdmin(email, "senhaErrada")).toBeNull();
  });

  it("retorna null para e-mail inexistente", async () => {
    expect(await autenticarAdmin("naoexiste@antoninaosteria.com", senha)).toBeNull();
  });
});
