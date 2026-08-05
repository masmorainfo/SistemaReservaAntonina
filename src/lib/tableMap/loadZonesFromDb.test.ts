import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { carregarZonasDoAmbiente } from "./loadZonesFromDb";

describe("carregarZonasDoAmbiente", () => {
  let ambienteId: string;

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Zonas" } });
    ambienteId = ambiente.id;

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "Z01",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 10, y: 20, largura: 8, altura: 8 }),
      },
    });

    await prisma.mesa.create({
      data: { ambienteId, numero: "Z02", capacidadeLugares: 4, posicaoTour: null },
    });
  });

  afterAll(async () => {
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna só mesas com posicaoTour cadastrada, com coordenadas parseadas", async () => {
    const zonas = await carregarZonasDoAmbiente(ambienteId);
    expect(zonas).toEqual([
      { mesaId: expect.any(String), numero: "Z01", coordenadas: { x: 10, y: 20, largura: 8, altura: 8 } },
    ]);
  });
});
