import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashSenha } from "./password";
import { autenticarAdmin } from "./authenticate";
import { limparTentativas, LIMITE_TENTATIVAS_LOGIN } from "./loginRateLimit";

describe("autenticarAdmin", () => {
  const email = "teste.fundacao@antoninaosteria.com";
  const senha = "senhaDeTeste123";

  beforeEach(() => {
    limparTentativas(email);
  });

  beforeAll(async () => {
    const dados = {
      nome: "Usuário de Teste",
      email,
      senhaHash: await hashSenha(senha),
      role: "DONO" as const,
    };

    // upsert em vez de create: a fixture precisa ser idempotente caso uma
    // execução anterior tenha sido interrompida antes do afterAll.
    await prisma.adminUser.upsert({
      where: { email },
      update: dados,
      create: dados,
    });
  });

  afterAll(async () => {
    await prisma.adminUser.delete({ where: { email } });
  });

  it("retorna dados da sessão com credenciais corretas", async () => {
    const resultado = await autenticarAdmin(email, senha);
    expect(resultado).toMatchObject({ email, role: "DONO" });
  });

  it("retorna null com senha incorreta", async () => {
    expect(await autenticarAdmin(email, "senhaErrada")).toBeNull();
  });

  it("retorna null para e-mail inexistente", async () => {
    const emailInexistente = "naoexiste@antoninaosteria.com";
    expect(await autenticarAdmin(emailInexistente, senha)).toBeNull();
    limparTentativas(emailInexistente);
  });

  it("conta corretamente tentativas concorrentes (não deixa um burst paralelo passar direto)", async () => {
    // Todas disparadas ao mesmo tempo via Promise.all, simulando um
    // brute-force paralelo em vez de sequencial — a reserva da tentativa
    // precisa acontecer de forma síncrona (antes de qualquer await) pra não
    // deixar esse burst inteiro passar pela checagem antes de qualquer uma
    // delas registrar sua falha.
    const tentativas = Array.from({ length: LIMITE_TENTATIVAS_LOGIN }, () =>
      autenticarAdmin(email, "senhaErrada")
    );
    const resultados = await Promise.all(tentativas);
    expect(resultados.every((r) => r === null)).toBe(true);

    expect(await autenticarAdmin(email, senha)).toBeNull();
  });

  it("bloqueia mesmo com a senha correta depois de muitas tentativas com senha errada", async () => {
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN; i++) {
      expect(await autenticarAdmin(email, "senhaErrada")).toBeNull();
    }

    expect(await autenticarAdmin(email, senha)).toBeNull();
  });

  it("um login com sucesso reseta o contador de tentativas falhas", async () => {
    for (let i = 0; i < LIMITE_TENTATIVAS_LOGIN - 1; i++) {
      expect(await autenticarAdmin(email, "senhaErrada")).toBeNull();
    }

    expect(await autenticarAdmin(email, senha)).toMatchObject({ email, role: "DONO" });

    // Depois de um login com sucesso, o contador zera — a mesma senha errada
    // de antes não deveria estar "quase" no limite de novo.
    expect(await autenticarAdmin(email, "senhaErrada")).toBeNull();
    expect(await autenticarAdmin(email, senha)).toMatchObject({ email, role: "DONO" });
  });
});
