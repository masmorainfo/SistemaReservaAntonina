import { prisma } from "@/lib/db";

export async function liberarHoldsExpirados(): Promise<void> {
  await prisma.reservaEvento.updateMany({
    where: {
      status: "AGUARDANDO_PAGAMENTO",
      holdExpiresAt: { lt: new Date() },
    },
    data: { status: "CANCELADA" },
  });
}

export async function dataDisponivelParaEvento(data: Date): Promise<boolean> {
  await liberarHoldsExpirados();

  const reservaAtiva = await prisma.reservaEvento.findFirst({
    where: {
      data,
      status: { in: ["AGUARDANDO_PAGAMENTO", "CONFIRMADA"] },
    },
  });

  return reservaAtiva === null;
}
