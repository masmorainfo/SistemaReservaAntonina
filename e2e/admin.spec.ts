import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";

async function loginComoDono(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("dono@antoninaosteria.com");
  await page.getByLabel("Senha").fill("trocar-esta-senha");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/admin/mapa-do-dia");
}

test.describe("Painel administrativo", () => {
  let ambienteId: string;
  let mesaId: string;

  test.beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Admin E2E" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({ data: { ambienteId, numero: "AD01", capacidadeLugares: 4 } });
    mesaId = mesa.id;

    await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Admin E2E",
        telefone: "+5541999997777",
        data: new Date(2027, 5, 1),
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });
  });

  test.afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  test("dono faz login e cancela uma reserva de mesa pelo mapa do dia", async ({ page }) => {
    await loginComoDono(page);

    await page.goto("/admin/mapa-do-dia");
    await page.getByLabel("Data").fill("2027-06-01");

    await expect(page.getByText("Cliente Admin E2E")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(page.getByText("Cliente Admin E2E")).not.toBeVisible();
  });

  test("dono navega pelo menu admin e faz logout", async ({ page }) => {
    await loginComoDono(page);

    await expect(page.getByRole("link", { name: "Eventos" })).toBeVisible();
    await page.getByRole("link", { name: "Política de Cancelamento" }).click();
    await page.waitForURL("**/admin/politica-cancelamento");
    await expect(page.getByRole("heading", { name: "Política de Cancelamento" })).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL("**/admin/login");

    await page.goto("/admin/mapa-do-dia");
    await page.waitForURL("**/admin/login");
  });
});
