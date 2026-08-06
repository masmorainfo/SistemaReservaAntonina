import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("GET /api/eventos/disponibilidade", () => {
  it("retorna 400 quando o parâmetro data está ausente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/disponibilidade");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna disponivel=true para uma data futura sem reserva", async () => {
    const data = proximaTercaFeiraDistante();
    const request = new NextRequest(`http://localhost/api/eventos/disponibilidade?data=${data}`);
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.disponivel).toBe(true);
  });
});
