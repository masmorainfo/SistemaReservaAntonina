import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("POST /api/eventos/reservas/[id]/cancelar", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Cancelamento", precoPessoa: 100, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("calcula e aplica o reembolso de 100% para cancelamento com 20 dias de antecedência", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "CONFIRMADA",
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CANCELADA");
    expect(body.reserva.percentualReembolsoAplicado).toBe("100");
    expect(body.reserva.valorReembolso).toBe("1100");
  });

  it("retorna 409 ao tentar cancelar uma reserva que não está confirmada", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste 2",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste2@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(20),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 60000),
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}/cancelar`, {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ id: reserva.id }) });
    expect(response.status).toBe(409);
  });
});
