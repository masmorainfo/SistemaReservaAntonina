import { describe, it, expect, beforeEach } from "vitest";
import {
  estaBloqueado,
  registrarTentativaFalha,
  limparTentativas,
  LIMITE_TENTATIVAS_LOGIN,
  JANELA_BLOQUEIO_MS,
  LIMITE_MAPA,
} from "./loginRateLimit";

describe("loginRateLimit", () => {
  const email = "rate-limit-teste@antoninaosteria.com";

  beforeEach(() => {
    limparTentativas(email);
  });

  it("não bloqueia um e-mail sem tentativas registradas", () => {
    expect(estaBloqueado(email)).toBe(false);
  });

  it("não bloqueia enquanto o número de falhas está abaixo do limite", () => {
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN - 1; i++) {
      registrarTentativaFalha(email);
    }
    expect(estaBloqueado(email)).toBe(false);
  });

  it("bloqueia assim que o número de falhas atinge o limite", () => {
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN; i++) {
      registrarTentativaFalha(email);
    }
    expect(estaBloqueado(email)).toBe(true);
  });

  it("libera o bloqueio depois que a janela de tempo expira", () => {
    const agora = Date.now();
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN; i++) {
      registrarTentativaFalha(email, agora);
    }
    expect(estaBloqueado(email, agora)).toBe(true);
    expect(estaBloqueado(email, agora + JANELA_BLOQUEIO_MS)).toBe(false);
  });

  it("limparTentativas reseta o contador imediatamente", () => {
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN; i++) {
      registrarTentativaFalha(email);
    }
    expect(estaBloqueado(email)).toBe(true);

    limparTentativas(email);

    expect(estaBloqueado(email)).toBe(false);
  });

  it("nunca descarta uma entrada existente pra abrir espaço, mesmo com o mapa cheio", () => {
    const agora = Date.now();
    const alvoReal = "alvo-real@ataque-sustentado.teste";

    // O alvo real já está bloqueado (rastreado antes de qualquer outra
    // coisa preencher o mapa).
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN; i++) {
      registrarTentativaFalha(alvoReal, agora);
    }
    expect(estaBloqueado(alvoReal, agora)).toBe(true);

    // Preenche o resto do mapa até o limite dentro da mesma janela (nada
    // aqui vai expirar) e tenta inserir mais um e-mail novo além da
    // capacidade — simula um atacante inundando o mapa com e-mails
    // inexistentes na tentativa de forçar a remoção do bloqueio do alvo real.
    for (let i = 0; i < LIMITE_MAPA - 1; i++) {
      registrarTentativaFalha(`email-${i}@ataque-sustentado.teste`, agora);
    }
    registrarTentativaFalha("email-excedente@ataque-sustentado.teste", agora);

    // O bloqueio do alvo real precisa sobreviver — nenhuma entrada existente
    // pode ser descartada só para abrir espaço para uma nova.
    expect(estaBloqueado(alvoReal, agora)).toBe(true);

    // Limpeza: sem isso, as ~1000 entradas sintéticas deste teste ficariam
    // ocupando o mapa compartilhado (módulo é singleton) e fariam os
    // próximos testes do arquivo falharem por "mapa cheio".
    limparTentativas(alvoReal);
    for (let i = 0; i < LIMITE_MAPA - 1; i++) {
      limparTentativas(`email-${i}@ataque-sustentado.teste`);
    }
    limparTentativas("email-excedente@ataque-sustentado.teste");
  });

  it("rastreia e-mails diferentes de forma independente", () => {
    const outroEmail = "outro-rate-limit-teste@antoninaosteria.com";
    limparTentativas(outroEmail);

    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN; i++) {
      registrarTentativaFalha(email);
    }

    expect(estaBloqueado(email)).toBe(true);
    expect(estaBloqueado(outroEmail)).toBe(false);

    limparTentativas(outroEmail);
  });
});
