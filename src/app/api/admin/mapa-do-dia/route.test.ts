import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

describe("GET /api/admin/mapa-do-dia", () => {
  it("retorna 401 sem sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const request = new NextRequest("http://localhost/api/admin/mapa-do-dia?data=2027-07-01");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("retorna 400 sem o parâmetro data, mesmo autenticado", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/mapa-do-dia");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna 200 com mesas e eventos para Recepção autenticada", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/mapa-do-dia?data=2027-07-01");
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toHaveProperty("mesas");
    expect(body).toHaveProperty("eventos");
  });
});
