import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { POST } from "./route";

describe("POST /api/admin/reservas-mesa/[id]/cancelar", () => {
  let ambienteId: string;
  let mesaId: string;
  let reservaId: string;

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Admin Cancelar" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({ data: { ambienteId, numero: "A01", capacidadeLugares: 4 } });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  beforeEach(async () => {
    const reserva = await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Teste",
        telefone: "+5541999999999",
        data: new Date(2027, 5, 1),
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });
    reservaId = reserva.id;
  });

  afterEach(async () => {
    // O índice único parcial "reserva_mesa_unica_confirmada_por_noite" permite
    // só uma reserva CONFIRMADA por (mesaId, data). Sem esta limpeza, o teste
    // de 401 (que não altera o status) colidiria com o beforeEach seguinte.
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
  });

  it("retorna 401 quando não há sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const request = new NextRequest(`http://localhost/api/admin/reservas-mesa/${reservaId}/cancelar`, {
      method: "POST",
    });
    const response = await POST(request, { params: Promise.resolve({ id: reservaId }) });
    expect(response.status).toBe(401);
  });

  it("cancela a reserva quando autenticado como Recepção", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest(`http://localhost/api/admin/reservas-mesa/${reservaId}/cancelar`, {
      method: "POST",
    });
    const response = await POST(request, { params: Promise.resolve({ id: reservaId }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CANCELADA");
  });
});
