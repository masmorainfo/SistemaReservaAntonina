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
});
