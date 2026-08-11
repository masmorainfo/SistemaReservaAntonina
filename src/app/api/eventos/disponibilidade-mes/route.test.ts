import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/eventos/disponibilidade-mes", () => {
  let reservaId: string;
  const anoTeste = 2027;
  const mesTeste = 9;

  beforeAll(async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste Mês",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste-mes@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: new Date(anoTeste, mesTeste - 1, 15),
        numConvidados: 10,
        valorTotal: 1000,
        status: "CONFIRMADA",
      },
    });
    reservaId = reserva.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.delete({ where: { id: reservaId } });
  });

  it("retorna 400 quando faltam parâmetros obrigatórios", async () => {
    const request = new NextRequest("http://localhost/api/eventos/disponibilidade-mes");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna as datas ocupadas do mês pedido", async () => {
    const params = new URLSearchParams({ ano: String(anoTeste), mes: String(mesTeste) });
    const request = new NextRequest(`http://localhost/api/eventos/disponibilidade-mes?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.datasOcupadas).toEqual([`${anoTeste}-09-15`]);
  });

  it("não retorna datas de outros meses", async () => {
    const params = new URLSearchParams({ ano: String(anoTeste), mes: "10" });
    const request = new NextRequest(`http://localhost/api/eventos/disponibilidade-mes?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.datasOcupadas).toEqual([]);
  });
});
