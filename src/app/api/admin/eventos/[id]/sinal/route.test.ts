import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { PATCH } from "./route";

describe("PATCH /api/admin/eventos/[id]/sinal", () => {
  let pacoteId: string;
  let reservaId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Sinal", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Negociado",
        clienteTelefone: "+5541999999999",
        clienteEmail: "negociado@exemplo.com",
        tipoEvento: "CORPORATIVO",
        data: new Date(2027, 8, 1),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        percentualSinal: 100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    reservaId = reserva.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("retorna 401 sem sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const request = new NextRequest(`http://localhost/api/admin/eventos/${reservaId}/sinal`, {
      method: "PATCH",
      body: JSON.stringify({ percentualSinal: 50 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: reservaId }) });
    expect(response.status).toBe(401);
  });

  it("atualiza o percentual de sinal quando autenticado como Recepção", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest(`http://localhost/api/admin/eventos/${reservaId}/sinal`, {
      method: "PATCH",
      body: JSON.stringify({ percentualSinal: 50 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: reservaId }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reserva.percentualSinal).toBe("50");
  });

  it("retorna 400 para percentual fora do intervalo válido", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest(`http://localhost/api/admin/eventos/${reservaId}/sinal`, {
      method: "PATCH",
      body: JSON.stringify({ percentualSinal: 150 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: reservaId }) });
    expect(response.status).toBe(400);
  });
});
