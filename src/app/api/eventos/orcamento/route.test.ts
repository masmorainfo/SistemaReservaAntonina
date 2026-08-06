import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";

describe("POST /api/eventos/orcamento", () => {
  it("cria o pedido de orçamento com dados válidos", async () => {
    const request = new NextRequest("http://localhost/api/eventos/orcamento", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Cliente Cardápio Aberto",
        clienteTelefone: "+5541999999999",
        clienteEmail: "cliente@exemplo.com",
        tipoEvento: "CORPORATIVO",
        dataDesejada: "2027-10-20",
        numConvidados: 25,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.pedido.clienteNome).toBe("Cliente Cardápio Aberto");

    await prisma.pedidoOrcamento.delete({ where: { id: body.pedido.id } });
  });

  it("retorna 400 com dados incompletos", async () => {
    const request = new NextRequest("http://localhost/api/eventos/orcamento", {
      method: "POST",
      body: JSON.stringify({ clienteNome: "Só o nome" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("retorna 400 quando observacoes não é string", async () => {
    const request = new NextRequest("http://localhost/api/eventos/orcamento", {
      method: "POST",
      body: JSON.stringify({
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "cliente@exemplo.com",
        tipoEvento: "CORPORATIVO",
        dataDesejada: "2027-10-20",
        numConvidados: 25,
        observacoes: 123,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("retorna 400 com JSON malformado no corpo da requisição", async () => {
    const request = new NextRequest("http://localhost/api/eventos/orcamento", {
      method: "POST",
      body: "isso não é JSON válido {",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
