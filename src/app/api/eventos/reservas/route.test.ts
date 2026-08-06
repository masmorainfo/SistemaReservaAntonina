import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("POST /api/eventos/reservas", () => {
  let pacoteId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Reserva Evento", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("cria o hold com valor calculado corretamente", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Empresa Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "contato@empresateste.com",
        tipoEvento: "CORPORATIVO",
        data,
        numConvidados: 10,
        pacoteId,
        equipamentoTelao: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reserva.valorTotal).toBe("2200");
    expect(body.reserva.status).toBe("AGUARDANDO_PAGAMENTO");
  });

  it("retorna 409 ao tentar reservar a mesma data de novo enquanto o hold está ativo", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Outra Empresa",
        clienteTelefone: "+5541988888888",
        clienteEmail: "outra@empresa.com",
        tipoEvento: "CORPORATIVO",
        data,
        numConvidados: 5,
        pacoteId,
        equipamentoTelao: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it("retorna 400 com JSON malformado no corpo da requisição", async () => {
    const request = new NextRequest("http://localhost/api/eventos/reservas", {
      method: "POST",
      body: "isso não é JSON válido {",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
