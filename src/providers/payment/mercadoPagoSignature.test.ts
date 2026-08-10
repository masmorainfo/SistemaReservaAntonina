import { describe, it, expect } from "vitest";
import { validarAssinaturaWebhook } from "./mercadoPagoSignature";
import { createHmac } from "node:crypto";

function assinar(dataId: string, requestId: string, ts: string, segredo: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", segredo).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("validarAssinaturaWebhook", () => {
  const segredo = "segredo-de-teste";

  it("valida uma assinatura corretamente gerada", () => {
    const assinatura = assinar("123456", "req-abc", "1700000000", segredo);

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "123456",
      segredo,
    });

    expect(resultado).toBe(true);
  });

  it("rejeita quando o hash não bate", () => {
    const assinatura = "ts=1700000000,v1=hashqualquerinvalido";

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "123456",
      segredo,
    });

    expect(resultado).toBe(false);
  });

  it("rejeita quando o dataId usado na validação é diferente do assinado", () => {
    const assinatura = assinar("123456", "req-abc", "1700000000", segredo);

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "999999",
      segredo,
    });

    expect(resultado).toBe(false);
  });

  it("rejeita quando o segredo usado na validação é diferente do assinado", () => {
    const assinatura = assinar("123456", "req-abc", "1700000000", segredo);

    const resultado = validarAssinaturaWebhook({
      assinatura,
      requestId: "req-abc",
      dataId: "123456",
      segredo: "segredo-errado",
    });

    expect(resultado).toBe(false);
  });

  it("rejeita uma assinatura em formato inválido (sem ts ou v1)", () => {
    const resultado = validarAssinaturaWebhook({
      assinatura: "formato-completamente-invalido",
      requestId: "req-abc",
      dataId: "123456",
      segredo,
    });

    expect(resultado).toBe(false);
  });
});
