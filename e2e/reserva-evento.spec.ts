import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { proximaTercaFeiraDistante } from "../src/test-utils/datas";

test.describe("Reserva de evento no mezanino", () => {
  let pacoteId: string;
  let dataEvento: string;

  test.beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote E2E", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;
    dataEvento = proximaTercaFeiraDistante();
  });

  test.afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { reservaEvento: { pacoteId } } });
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  test("cliente reserva um evento e paga o sinal do início ao fim", async ({ page }) => {
    await page.goto("/reservar-evento");

    await page.getByLabel("Data").fill(dataEvento);
    await page.getByLabel("Nome").fill("Empresa E2E");
    await page.getByLabel("Telefone").fill("+5541999998888");
    await page.getByLabel("E-mail").fill("contato@empresae2e.com");
    await page.getByText("Verificar disponibilidade").click();

    await page.getByText("Pacote E2E", { exact: false }).click();
    await page.getByText("Continuar para pagamento").click();

    await page.getByLabel("Pix").check();
    await page.getByText("Confirmar pagamento").click();

    await expect(page.getByRole("status")).toContainText("Evento confirmado");
  });
});
