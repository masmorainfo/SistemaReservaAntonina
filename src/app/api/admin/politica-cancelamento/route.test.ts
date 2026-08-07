import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
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
  // O caminho de sucesso do PUT substitui a tabela inteira (deleteMany +
  // createMany) — comportamento real da rota, mas que colide com o banco de
  // dev compartilhado por outros testes (ex.: cancelamento de reserva de
  // evento, que depende da política padrão semeada). Guardamos o estado
  // original aqui e restauramos em afterAll para não vazar esse efeito
  // colateral para o resto da suíte.
  let tiersOriginais: Awaited<ReturnType<typeof prisma.politicaCancelamento.findMany>> = [];

  beforeAll(async () => {
    tiersOriginais = await prisma.politicaCancelamento.findMany();
  });

  afterEach(async () => {
    await prisma.politicaCancelamento.deleteMany({ where: { diasMinimos: 9999 } });
  });

  afterAll(async () => {
    const restantes = await prisma.politicaCancelamento.count();
    if (restantes === 0 && tiersOriginais.length > 0) {
      await prisma.politicaCancelamento.createMany({
        data: tiersOriginais.map((t) => ({
          diasMinimos: t.diasMinimos,
          diasMaximos: t.diasMaximos,
          percentualReembolso: t.percentualReembolso,
        })),
      });
    }
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

  it("retorna 400 quando percentualReembolso está fora do intervalo válido", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "DONO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento", {
      method: "PUT",
      body: JSON.stringify([{ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 150 }]),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);

    const tiers = await prisma.politicaCancelamento.findMany({ where: { diasMinimos: 9999 } });
    expect(tiers).toHaveLength(0);
  });
});
