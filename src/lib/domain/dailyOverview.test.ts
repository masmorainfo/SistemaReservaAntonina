import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buscarMapaDoDia } from "./dailyOverview";

describe("buscarMapaDoDia", () => {
  let ambienteId: string;
  let mesaId: string;
  let pacoteId: string;
  const data = new Date(2027, 6, 1);

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Mapa" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({ data: { ambienteId, numero: "M01", capacidadeLugares: 4 } });
    mesaId = mesa.id;

    await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Visível",
        telefone: "+5541999999999",
        data,
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });

    await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Cancelado",
        telefone: "+5541999999998",
        data,
        horarioChegada: "19:30",
        numPessoas: 2,
        status: "CANCELADA",
      },
    });

    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Mapa", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    await prisma.reservaEvento.create({
      data: {
        clienteNome: "Empresa Visível",
        clienteTelefone: "+5541999999997",
        clienteEmail: "visivel@exemplo.com",
        tipoEvento: "CORPORATIVO",
        data,
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status: "CONFIRMADA",
      },
    });
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna as reservas de mesa e evento não canceladas do dia", async () => {
    const resultado = await buscarMapaDoDia(data);

    expect(resultado.mesas).toHaveLength(1);
    expect(resultado.mesas[0].nomeCliente).toBe("Cliente Visível");
    expect(resultado.mesas[0].ambienteNome).toBe("Ambiente Teste Mapa");

    expect(resultado.eventos).toHaveLength(1);
    expect(resultado.eventos[0].clienteNome).toBe("Empresa Visível");
    expect(resultado.eventos[0].pacoteNome).toBe("Pacote Teste Mapa");
  });
});
