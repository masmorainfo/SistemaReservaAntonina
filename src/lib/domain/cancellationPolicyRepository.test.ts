import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buscarTiersPoliticaCancelamento } from "./cancellationPolicyRepository";

describe("buscarTiersPoliticaCancelamento", () => {
  let tierId: string;

  beforeAll(async () => {
    const tier = await prisma.politicaCancelamento.create({
      data: { diasMinimos: 9999, diasMaximos: null, percentualReembolso: 42 },
    });
    tierId = tier.id;
  });

  afterAll(async () => {
    await prisma.politicaCancelamento.delete({ where: { id: tierId } });
  });

  it("inclui o tier inserido, convertendo Decimal para number", async () => {
    const tiers = await buscarTiersPoliticaCancelamento();
    const tierInserido = tiers.find((t) => t.diasMinimos === 9999);
    expect(tierInserido).toEqual({ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 42 });
  });
});
