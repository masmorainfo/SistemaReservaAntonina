import { describe, it, expect } from "vitest";
import { LogNotificationProvider } from "./LogNotificationProvider";

describe("LogNotificationProvider", () => {
  it("registra a notificação enviada em memória", async () => {
    const provider = new LogNotificationProvider();
    await provider.enviar({ telefone: "+5541999999999", mensagem: "Reserva confirmada" });

    expect(provider.obterEnviados()).toHaveLength(1);
    expect(provider.obterEnviados()[0]).toEqual({
      telefone: "+5541999999999",
      mensagem: "Reserva confirmada",
    });
  });
});
