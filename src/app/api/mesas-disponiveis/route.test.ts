import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("GET /api/mesas-disponiveis", () => {
  let ambienteId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Rota Mesas" } });
    ambienteId = ambiente.id;
    await prisma.mesa.create({ data: { ambienteId, numero: "R01", capacidadeLugares: 4 } });
  });

  afterAll(async () => {
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna 400 quando faltam parâmetros obrigatórios", async () => {
    const request = new NextRequest("http://localhost/api/mesas-disponiveis");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna as mesas disponíveis para o ambiente, data e número de pessoas", async () => {
    const params = new URLSearchParams({ ambienteId, data, numPessoas: "2" });
    const request = new NextRequest(`http://localhost/api/mesas-disponiveis?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mesas).toHaveLength(1);
    expect(body.mesas[0].numero).toBe("R01");
  });

  it("inclui mesas ocupadas na resposta, marcadas com faixa 'ocupada'", async () => {
    const mesaOcupada = await prisma.mesa.create({
      data: { ambienteId, numero: "R02", capacidadeLugares: 4 },
    });
    await prisma.reservaMesa.create({
      data: {
        mesaId: mesaOcupada.id,
        nomeCliente: "Cliente Ocupado",
        telefone: "+5541999999998",
        data: new Date(`${data}T00:00:00`),
        horarioChegada: "19:30",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });

    const params = new URLSearchParams({ ambienteId, data, numPessoas: "2" });
    const request = new NextRequest(`http://localhost/api/mesas-disponiveis?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const mesaR02 = body.mesas.find((m: { numero: string }) => m.numero === "R02");
    expect(mesaR02.faixa).toBe("ocupada");

    await prisma.reservaMesa.deleteMany({ where: { mesaId: mesaOcupada.id } });
    await prisma.mesa.delete({ where: { id: mesaOcupada.id } });
  });
});
