import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularPercentualReembolso } from "@/lib/domain/refundPolicy";
import { buscarTiersPoliticaCancelamento } from "@/lib/domain/cancellationPolicyRepository";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";

function diasEntre(dataEvento: Date, agora: Date): number {
  const dataEventoUTC = Date.UTC(dataEvento.getUTCFullYear(), dataEvento.getUTCMonth(), dataEvento.getUTCDate());
  const agoraUTC = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffMs = dataEventoUTC - agoraUTC;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id },
    include: { pagamento: true },
  });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "CONFIRMADA") {
    return NextResponse.json({ erro: "só é possível cancelar uma reserva confirmada" }, { status: 409 });
  }

  const tiers = await buscarTiersPoliticaCancelamento();
  const dias = diasEntre(reserva.data, new Date());
  const percentualReembolso = calcularPercentualReembolso(dias, tiers);
  const valorReembolso = Math.round(Number(reserva.valorTotal) * (percentualReembolso / 100) * 100) / 100;

  if (reserva.pagamento && reserva.pagamento.status === "APROVADO" && valorReembolso > 0) {
    const provider = getPaymentProvider();
    try {
      const resultadoEstorno = await provider.estornar(reserva.pagamento.referenciaExterna, valorReembolso);
      if (resultadoEstorno.status !== "aprovado") {
        return NextResponse.json(
          { erro: "não foi possível efetuar o estorno junto ao gateway de pagamento" },
          { status: 500 }
        );
      }
    } catch {
      return NextResponse.json(
        { erro: "não foi possível comunicar com o gateway de pagamento para efetuar o estorno" },
        { status: 500 }
      );
    }
  }

  const atualizada = await prisma.reservaEvento.update({
    where: { id },
    data: {
      status: "CANCELADA",
      percentualReembolsoAplicado: percentualReembolso,
      valorReembolso,
    },
  });

  return NextResponse.json({ reserva: atualizada });
}
