import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";
import { daquiADias } from "@/test-utils/datas";

describe("GET /api/eventos/reservas/[id]", () => {
  let pacoteId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Status Reserva", precoPessoa: 150, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEvento: { pacoteId } } });
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("retorna 404 para reserva inexistente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas/id-que-nao-existe");
    const response = await GET(request, { params: Promise.resolve({ id: "id-que-nao-existe" }) });
    expect(response.status).toBe(404);
  });

  it("retorna o status da reserva sem pagamento associado", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(25),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1650,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}`);
    const response = await GET(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(body.pagamento).toBeNull();
  });

  it("retorna o status do pagamento quando existe", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste 2",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste2@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: daquiADias(26),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1650,
        status: "CONFIRMADA",
      },
    });
    await prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: "mercadopago",
        metodo: "PIX",
        valor: 1650,
        status: "APROVADO",
        referenciaExterna: "ref-status-teste",
      },
    });

    const request = new NextRequest(`http://localhost/api/eventos/reservas/${reserva.id}`);
    const response = await GET(request, { params: Promise.resolve({ id: reserva.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CONFIRMADA");
    expect(body.pagamento.status).toBe("APROVADO");
  });
});
