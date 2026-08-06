import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { dataDisponivelParaEvento } from "./eventHolds";

describe("dataDisponivelParaEvento", () => {
  const data = new Date(2027, 8, 10);

  afterEach(async () => {
    await prisma.reservaEvento.deleteMany({ where: { data } });
  });

  it("retorna true quando não há reserva para a data", async () => {
    expect(await dataDisponivelParaEvento(data)).toBe(true);
  });

  it("retorna false quando existe reserva CONFIRMADA na data", async () => {
    await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        valorTotal: 1000,
        status: "CONFIRMADA",
      },
    });

    expect(await dataDisponivelParaEvento(data)).toBe(false);
  });

  it("retorna false quando existe hold válido (AGUARDANDO_PAGAMENTO não expirado)", async () => {
    await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        valorTotal: 1000,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    expect(await dataDisponivelParaEvento(data)).toBe(false);
  });

  it("libera e retorna true quando o hold já expirou", async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data,
        numConvidados: 10,
        valorTotal: 1000,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    expect(await dataDisponivelParaEvento(data)).toBe(true);

    const atualizada = await prisma.reservaEvento.findUnique({ where: { id: reserva.id } });
    expect(atualizada?.status).toBe("CANCELADA");
  });
});
