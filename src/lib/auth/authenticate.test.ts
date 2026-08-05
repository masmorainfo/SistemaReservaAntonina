import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashSenha } from "./password";
import { autenticarAdmin } from "./authenticate";

describe("autenticarAdmin", () => {
  const email = "teste.fundacao@antoninaosteria.com";
  const senha = "senhaDeTeste123";

  beforeAll(async () => {
    const dados = {
      nome: "Usuário de Teste",
      email,
      senhaHash: await hashSenha(senha),
      role: "DONO" as const,
    };

    // upsert em vez de create: a fixture precisa ser idempotente caso uma
    // execução anterior tenha sido interrompida antes do afterAll.
    await prisma.adminUser.upsert({
      where: { email },
      update: dados,
      create: dados,
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
