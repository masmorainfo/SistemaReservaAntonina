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

describe("Mesa.diasSemanaAtivos", () => {
  afterEach(async () => {
    // Mesa -> Ambiente é ON DELETE RESTRICT: apagar as mesas primeiro.
    await prisma.mesa.deleteMany({
      where: { ambiente: { nome: "Ambiente de Teste" } },
    });
    await prisma.ambiente.deleteMany({ where: { nome: "Ambiente de Teste" } });
  });

  it("assume todos os dias da semana como padrão quando não especificado", async () => {
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente de Teste" },
    });

    const mesa = await prisma.mesa.create({
      data: {
        numero: "11",
        capacidadeLugares: 4,
        ambienteId: ambiente.id,
      },
    });

    expect(mesa.diasSemanaAtivos).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("permite duas Mesas com o mesmo número no mesmo Ambiente em dias distintos", async () => {
    // Cenário real: mesas duplas do Deck (11, 12, 21) viram mesa única de 4
    // lugares dom-qui, e são separadas em duas mesas de 2 lugares sex/sáb.
    // O mesmo número "11" existe nos dois conjuntos, ativos em dias diferentes.
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente de Teste" },
    });

    const mesaPadrao = await prisma.mesa.create({
      data: {
        numero: "11",
        capacidadeLugares: 4,
        ambienteId: ambiente.id,
        diasSemanaAtivos: [0, 1, 2, 3, 4],
      },
    });

    const mesaFimDeSemana = await prisma.mesa.create({
      data: {
        numero: "11",
        capacidadeLugares: 2,
        ambienteId: ambiente.id,
        diasSemanaAtivos: [5, 6],
      },
    });

    expect(mesaPadrao.numero).toBe(mesaFimDeSemana.numero);
    expect(mesaPadrao.ambienteId).toBe(mesaFimDeSemana.ambienteId);
    expect(mesaPadrao.id).not.toBe(mesaFimDeSemana.id);
  });
});
