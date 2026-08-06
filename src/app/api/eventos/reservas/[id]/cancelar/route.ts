import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularPercentualReembolso } from "@/lib/domain/refundPolicy";
import { buscarTiersPoliticaCancelamento } from "@/lib/domain/cancellationPolicyRepository";

function diasEntre(dataEvento: Date, agora: Date): number {
  // dataEvento vem de uma coluna @db.Date: o Prisma sempre a devolve como
  // meia-noite UTC, independentemente do fuso em que o valor foi criado.
  // agora é um instante real no fuso local do servidor. Para comparar
  // "dias de calendário" sem viés de fuso ou hora do dia, extraímos os
  // componentes de data de cada um do jeito certo (UTC para a coluna já
  // normalizada, local para "hoje") e diferenciamos duas meias-noites UTC.
  const dataEventoUTC = Date.UTC(dataEvento.getUTCFullYear(), dataEvento.getUTCMonth(), dataEvento.getUTCDate());
  const agoraUTC = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffMs = dataEventoUTC - agoraUTC;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reserva = await prisma.reservaEvento.findUnique({ where: { id } });

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
