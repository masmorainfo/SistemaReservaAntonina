import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/eventos/reservas/[id]", () => {
  let pacoteId: string;
  let reservaId: string;

  beforeEach(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste GET", precoPessoa: 100, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "41999998888",
        clienteEmail: "cliente@teste.com",
        tipoEvento: "ANIVERSARIO",
        data: new Date("2026-10-15T00:00:00Z"),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "AGUARDANDO_PAGAMENTO",
      },
    });
    reservaId = reserva.id;
  });

  afterEach(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEventoId: reservaId } });
    await prisma.reservaEvento.deleteMany({ where: { id: reservaId } });
    await prisma.pacote.deleteMany({ where: { id: pacoteId } });
  });

  it("retorna 404 para id inexistente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas/inexistente");
    const response = await GET(request, { params: Promise.resolve({ id: "inexistente" }) });

    expect(response.status).toBe(404);
  });

  it("retorna os detalhes da reserva e pagamento quando existe", async () => {
    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reservaId}`);
    const response = await GET(request, { params: Promise.resolve({ id: reservaId }) });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reserva.id).toBe(reservaId);
    expect(body.reserva.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(body.reserva.pagamento).toBeNull();
  });
});
