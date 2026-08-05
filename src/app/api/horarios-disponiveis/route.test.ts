import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("GET /api/horarios-disponiveis", () => {
  it("retorna 400 quando o parâmetro data está ausente", async () => {
    const request = new NextRequest("http://localhost/api/horarios-disponiveis");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna horários de jantar para uma terça-feira futura sem feriado cadastrado", async () => {
    const data = proximaTercaFeiraDistante();
    const request = new NextRequest(`http://localhost/api/horarios-disponiveis?data=${data}`);
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.horarios).toEqual(["18:30", "19:00", "19:30"]);
  });
});
