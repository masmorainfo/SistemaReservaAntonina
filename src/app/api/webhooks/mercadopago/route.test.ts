import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";

describe("POST /api/webhooks/mercadopago", () => {
  let pacoteId: string;
  let reservaId: string;
  let pagamentoId: string;
  const refExterna = "mp_ref_12345";

  beforeEach(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Webhook Test", precoPessoa: 100, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Webhook",
        clienteTelefone: "41999998888",
        clienteEmail: "webhook@teste.com",
        tipoEvento: "ANIVERSARIO",
        data: new Date("2026-11-20T00:00:00Z"),
        numConvidados: 10,
        pacoteId,
        valorTotal: 1100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    reservaId = reserva.id;

    const pagamento = await prisma.pagamento.create({
      data: {
        reservaEventoId: reservaId,
        provedor: "mock",
        metodo: "PIX",
        valor: 1100,
        status: "PENDENTE",
        referenciaExterna: refExterna,
      },
    });
    pagamentoId = pagamento.id;
  });

  afterEach(async () => {
    await prisma.pagamento.deleteMany({ where: { id: pagamentoId } });
    await prisma.reservaEvento.deleteMany({ where: { id: reservaId } });
    await prisma.pacote.deleteMany({ where: { id: pacoteId } });
  });

  it("retorna 401 quando x-signature está ausente", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/mercadopago?data.id=123", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("processa o webhook com sucesso para MockPaymentProvider", async () => {
    const request = new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${refExterna}`, {
      method: "POST",
      headers: {
        "x-signature": "sig-valida",
        "x-request-id": "req-1",
      },
      body: JSON.stringify({ referenciaExterna: refExterna }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const reservaAtualizada = await prisma.reservaEvento.findUnique({ where: { id: reservaId } });
    expect(reservaAtualizada?.status).toBe("CONFIRMADA");

    const pagamentoAtualizado = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
    expect(pagamentoAtualizado?.status).toBe("APROVADO");
  });
});
