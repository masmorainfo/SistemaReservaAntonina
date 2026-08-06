import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PUT } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("PUT /api/eventos/reservas/[id]/pratos", () => {
  let pacoteId: string;
  let reservaConfirmadaId: string;
  let reservaPendenteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Pratos", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    const confirmada = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Confirmado",
        clienteTelefone: "+5541999999999",
        clienteEmail: "confirmado@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status: "CONFIRMADA",
      },
    });
    reservaConfirmadaId = confirmada.id;

    const pendente = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Pendente",
        clienteTelefone: "+5541999999998",
        clienteEmail: "pendente@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(21),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 60000),
      },
    });
    reservaPendenteId = pendente.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("grava os pratos escolhidos numa reserva confirmada", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaConfirmadaId}/pratos`, {
      method: "PUT",
      body: JSON.stringify({
        entradas: ["Arancini", "Fritte Al Tartufo", "Caesar"],
        principais: ["Gnocchi Al Ragu", "Funghi e Filetto", "Cappelletti", "Gnocchi Grelhado"],
        sobremesa: "Tiramisu",
      }),
    });

    const response = await PUT(request, { params: { id: reservaConfirmadaId } });
    expect(response.status).toBe(200);
  });

  it("retorna 400 quando a contagem de pratos está errada", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaConfirmadaId}/pratos`, {
      method: "PUT",
      body: JSON.stringify({ entradas: ["Arancini"], principais: [], sobremesa: "Tiramisu" }),
    });

    const response = await PUT(request, { params: { id: reservaConfirmadaId } });
    expect(response.status).toBe(400);
  });

  it("retorna 409 quando a reserva ainda não está confirmada", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaPendenteId}/pratos`, {
      method: "PUT",
      body: JSON.stringify({
        entradas: ["Arancini", "Fritte Al Tartufo", "Caesar"],
        principais: ["Gnocchi Al Ragu", "Funghi e Filetto", "Cappelletti", "Gnocchi Grelhado"],
        sobremesa: "Tiramisu",
      }),
    });

    const response = await PUT(request, { params: { id: reservaPendenteId } });
    expect(response.status).toBe(409);
  });

  it("retorna 400 quando o corpo da requisição é JSON inválido", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaConfirmadaId}/pratos`, {
      method: "PUT",
      body: "{ json inválido",
    });

    const response = await PUT(request, { params: { id: reservaConfirmadaId } });
    expect(response.status).toBe(400);
  });
});
