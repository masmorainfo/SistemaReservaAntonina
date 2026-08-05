import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./db";

describe("prisma client", () => {
  afterEach(async () => {
    await prisma.ambiente.deleteMany({ where: { nome: "Ambiente de Teste" } });
  });

  it("cria e lê um Ambiente no banco real", async () => {
    const criado = await prisma.ambiente.create({
      data: { nome: "Ambiente de Teste" },
    });

    const encontrado = await prisma.ambiente.findUnique({
      where: { id: criado.id },
    });

    expect(encontrado?.nome).toBe("Ambiente de Teste");
  });
});
