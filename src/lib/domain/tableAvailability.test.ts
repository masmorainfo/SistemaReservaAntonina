import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buscarMesasDisponiveis } from "./tableAvailability";

describe("buscarMesasDisponiveis", () => {
  let ambienteId: string;
  let mesaLivreId: string;
  let mesaReservadaId: string;
  const data = new Date(2027, 5, 15);

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente Teste Disponibilidade" },
    });
    ambienteId = ambiente.id;

    const mesaLivre = await prisma.mesa.create({
      data: { ambienteId, numero: "T01", capacidadeLugares: 4 },
    });
    mesaLivreId = mesaLivre.id;

    const mesaReservada = await prisma.mesa.create({
      data: { ambienteId, numero: "T02", capacidadeLugares: 4 },
    });
    mesaReservadaId = mesaReservada.id;

    await prisma.reservaMesa.create({
      data: {
        mesaId: mesaReservadaId,
        nomeCliente: "Cliente Teste",
        telefone: "+5541999999999",
        data,
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId: { in: [mesaLivreId, mesaReservadaId] } } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna só a mesa livre, excluindo a já reservada na data", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data, numPessoas: 2 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].numero).toBe("T01");
  });

  it("retorna vazio quando nenhuma mesa comporta o grupo", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data, numPessoas: 20 });
    expect(resultado).toEqual([]);
  });
});

describe("buscarMesasDisponiveis - filtro por diasSemanaAtivos (mesas duplas do Deck)", () => {
  let ambienteId: string;
  let mesaDomingoQuintaId: string;
  let mesaSextaSabadoId: string;
  const terca = new Date(2027, 5, 15); // terça-feira (getDay() === 2)
  const sabado = new Date(2027, 5, 19); // sábado (getDay() === 6)

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente Teste Mesas Duplas Deck" },
    });
    ambienteId = ambiente.id;

    const mesaDomingoQuinta = await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "11",
        capacidadeLugares: 4,
        diasSemanaAtivos: [0, 1, 2, 3, 4],
      },
    });
    mesaDomingoQuintaId = mesaDomingoQuinta.id;

    const mesaSextaSabado = await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "11",
        capacidadeLugares: 4,
        diasSemanaAtivos: [5, 6],
      },
    });
    mesaSextaSabadoId = mesaSextaSabado.id;
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({
      where: { mesaId: { in: [mesaDomingoQuintaId, mesaSextaSabadoId] } },
    });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("numa terça-feira, retorna só o registro ativo de domingo a quinta", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data: terca, numPessoas: 2 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(mesaDomingoQuintaId);
    expect(resultado[0].numero).toBe("11");
  });

  it("num sábado, retorna só o registro ativo de sexta/sábado", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data: sabado, numPessoas: 2 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(mesaSextaSabadoId);
    expect(resultado[0].numero).toBe("11");
  });
});
