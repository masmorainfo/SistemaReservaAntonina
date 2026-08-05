import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { carregarZonasDoAmbiente } from "./loadZonesFromDb";

describe("carregarZonasDoAmbiente", () => {
  let ambienteId: string;

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Zonas" } });
    ambienteId = ambiente.id;
  });

  afterEach(async () => {
    await prisma.mesa.deleteMany({ where: { ambienteId } });
  });

  afterAll(async () => {
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna só mesas com posicaoTour cadastrada, com coordenadas parseadas", async () => {
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

    const zonas = await carregarZonasDoAmbiente(ambienteId);
    expect(zonas).toEqual([
      { mesaId: expect.any(String), numero: "Z01", coordenadas: { x: 10, y: 20, largura: 8, altura: 8 } },
    ]);
  });

  it("pula mesas com JSON malformado em posicaoTour (não lança erro)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "BAD01",
        capacidadeLugares: 4,
        posicaoTour: "{invalid json}",
      },
    });

    const zonas = await carregarZonasDoAmbiente(ambienteId);

    expect(zonas).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    const firstCall = warnSpy.mock.calls[0];
    expect(firstCall[0]).toContain("[loadZonesFromDb] Skipping mesa");
    expect(firstCall[0]).toContain("malformed JSON");

    warnSpy.mockRestore();
  });

  it("pula mesas com posicaoTour faltando campos requeridos (não lança erro)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "INCOMPLETE",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 10, y: 20 }), // Faltam largura e altura
      },
    });

    const zonas = await carregarZonasDoAmbiente(ambienteId);

    expect(zonas).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    const firstCall = warnSpy.mock.calls[0];
    expect(firstCall[0]).toContain("[loadZonesFromDb] Skipping mesa");
    expect(firstCall[0]).toContain("invalid shape");

    warnSpy.mockRestore();
  });

  it("pula mesas com campos de tipo errado em posicaoTour (não lança erro)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "WRONGTYPE",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: "10", y: 20, largura: 8, altura: 8 }), // x é string, não number
      },
    });

    const zonas = await carregarZonasDoAmbiente(ambienteId);

    expect(zonas).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    const firstCall = warnSpy.mock.calls[0];
    expect(firstCall[0]).toContain("[loadZonesFromDb] Skipping mesa");
    expect(firstCall[0]).toContain("invalid shape");

    warnSpy.mockRestore();
  });

  it("retorna mesas válidas e pula as inválidas (misto) sem crashar", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mesa válida
    const validMesa = await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "VALID01",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 10, y: 20, largura: 8, altura: 8 }),
      },
    });

    // Mesa com JSON malformado
    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "BAD02",
        capacidadeLugares: 4,
        posicaoTour: "not json at all",
      },
    });

    // Outra mesa válida
    const validMesa2 = await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "VALID02",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 30, y: 40, largura: 6, altura: 6 }),
      },
    });

    const zonas = await carregarZonasDoAmbiente(ambienteId);

    expect(zonas).toHaveLength(2);
    expect(zonas).toContainEqual({
      mesaId: validMesa.id,
      numero: "VALID01",
      coordenadas: { x: 10, y: 20, largura: 8, altura: 8 },
    });
    expect(zonas).toContainEqual({
      mesaId: validMesa2.id,
      numero: "VALID02",
      coordenadas: { x: 30, y: 40, largura: 6, altura: 6 },
    });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
