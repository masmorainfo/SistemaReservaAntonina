import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { GET, PUT } from "./route";

describe("GET /api/admin/politica-cancelamento", () => {
  it("retorna 200 para Recepção autenticada", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento");
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});

describe("PUT /api/admin/politica-cancelamento", () => {
  afterEach(async () => {
    await prisma.politicaCancelamento.deleteMany({ where: { diasMinimos: 9999 } });
  });

  it("retorna 403 quando quem tenta editar é Recepção", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento", {
      method: "PUT",
      body: JSON.stringify([{ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 10 }]),
    });
    const response = await PUT(request);
    expect(response.status).toBe(403);
  });

  it("substitui a tabela quando autenticado como Dono", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "DONO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento", {
      method: "PUT",
      body: JSON.stringify([{ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 10 }]),
    });
    const response = await PUT(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tiersCriados).toBe(1);

    const tiers = await prisma.politicaCancelamento.findMany();
    expect(tiers).toHaveLength(1);
    expect(tiers[0].diasMinimos).toBe(9999);
  });
});
