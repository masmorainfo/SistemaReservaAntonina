import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id },
    include: { pagamento: true },
  });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    reserva: {
      id: reserva.id,
      status: reserva.status,
      clienteNome: reserva.clienteNome,
      data: reserva.data.toISOString().split("T")[0],
      numConvidados: reserva.numConvidados,
      valorTotal: Number(reserva.valorTotal),
      holdExpiresAt: reserva.holdExpiresAt ? reserva.holdExpiresAt.toISOString() : null,
      pagamento: reserva.pagamento
        ? {
            id: reserva.pagamento.id,
            status: reserva.pagamento.status,
            provedor: reserva.pagamento.provedor,
            metodo: reserva.pagamento.metodo,
          }
        : null,
    },
  });
}
