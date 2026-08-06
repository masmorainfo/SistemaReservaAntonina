import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("POST /api/reservas-mesa", () => {
  let ambienteId: string;
  let mesaId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Criação" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({
      data: { ambienteId, numero: "C01", capacidadeLugares: 4 },
    });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("cria a reserva com dados válidos", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId,
        nomeCliente: "Maria Teste",
        telefone: "+5541988887777",
        data,
        horarioChegada: "19:00",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("retorna 409 ao tentar reservar a mesma mesa na mesma data novamente", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId,
        nomeCliente: "Outro Cliente",
        telefone: "+5541977776666",
        data,
        horarioChegada: "19:30",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.erro).toContain("reservada");
  });

  it("retorna 400 com dados incompletos", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({ mesaId }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("retorna 400 quando o corpo não é um JSON válido", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: "{ isso não é json",
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.erro).toBeTruthy();
  });

});

describe("POST /api/reservas-mesa - horarioChegada fora dos horários oferecidos", () => {
  let ambienteId: string;
  let mesaId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente Teste POST Horário Inválido" },
    });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({
      data: { ambienteId, numero: "H01", capacidadeLugares: 4 },
    });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna 400 quando horarioChegada não é um horário oferecido para essa data", async () => {
    // `data` é sempre uma terça-feira futura sem feriado, cuja única janela é
    // o jantar (18:30-19:30) — "23:59" não é um dos slots gerados por
    // gerarHorariosDisponiveis para esse dia.
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId,
        nomeCliente: "Cliente Horário Inválido",
        telefone: "+5541966665555",
        data,
        horarioChegada: "23:59",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/reservas-mesa - revalidação de diasSemanaAtivos (mesas duplas do Deck)", () => {
  let ambienteId: string;
  let mesaDomingoQuintaId: string;
  let mesaSextaSabadoId: string;
  const terca = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente Teste POST Mesas Duplas" },
    });
    ambienteId = ambiente.id;

    const mesaDomingoQuinta = await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "12",
        capacidadeLugares: 4,
        diasSemanaAtivos: [0, 1, 2, 3, 4],
      },
    });
    mesaDomingoQuintaId = mesaDomingoQuinta.id;

    const mesaSextaSabado = await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "12",
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

  it("rejeita reserva no registro de Mesa inativo para o dia da semana da data pedida", async () => {
    // `terca` é sempre uma terça-feira, então o registro sexta/sábado
    // (diasSemanaAtivos [5, 6]) não está ativo nesse dia — POSTar o mesaId
    // dele deve ser rejeitado mesmo sem nenhuma reserva concorrente.
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId: mesaSextaSabadoId,
        nomeCliente: "Cliente Mesa Inativa",
        telefone: "+5541955554444",
        data: terca,
        horarioChegada: "19:00",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it("aceita reserva no registro de Mesa ativo para o dia da semana da data pedida", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId: mesaDomingoQuintaId,
        nomeCliente: "Cliente Mesa Ativa",
        telefone: "+5541944443333",
        data: terca,
        horarioChegada: "19:00",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
