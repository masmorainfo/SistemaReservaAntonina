import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { proximaTercaFeiraDistante } from "../src/test-utils/datas";

test.describe("Reserva de mesa diária", () => {
  let ambienteId: string;
  let dataReserva: string;

  test.beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente E2E" } });
    ambienteId = ambiente.id;

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "E01",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 10, y: 10, largura: 20, altura: 20 }),
      },
    });

    dataReserva = proximaTercaFeiraDistante();
  });

  test.afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesa: { ambienteId } } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  test("cliente reserva uma mesa do início ao fim", async ({ page }) => {
    await page.goto("/reservar-mesa");

    await page.getByLabel("Data").fill(dataReserva);
    await page.getByText("Ver horários").click();

    await page.getByLabel("Horário").selectOption("19:00");
    await page.getByLabel("Número de pessoas").fill("2");
    await page.getByText("Escolher mesa").click();

    // O brief original assumia role="tab" (padrão ARIA Tabs), mas o commit
    // b677dff trocou o seletor de ambiente para role="group" + botões
    // simples (aria-pressed) por ser a semântica correta para o que o
    // componente realmente implementa (sem tabpanel/navegação por setas).
    // Seletor ajustado para refletir o DOM real.
    await page.getByRole("button", { name: "Ambiente E2E" }).click();
    // Tanto o botão do mapa quanto o da lista acessível abrem a mesma seleção — .first() é intencional.
    await page.getByText("Mesa E01", { exact: false }).first().click();
    await page.getByText("Continuar").click();

    await page.getByLabel("Nome").fill("Cliente E2E");
    await page.getByLabel("Telefone").fill("+5541999998888");
    await page.getByText("Confirmar reserva").click();

    await expect(page.getByRole("status")).toContainText("Reserva confirmada");
  });
});
