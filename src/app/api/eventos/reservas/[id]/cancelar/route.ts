import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularPercentualReembolso } from "@/lib/domain/refundPolicy";
import { buscarTiersPoliticaCancelamento } from "@/lib/domain/cancellationPolicyRepository";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";

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

// LIMITAÇÃO CONHECIDA: esta rota não verifica se quem chama é o dono da
// reserva — qualquer pessoa que descubra o id (cuid) pode cancelar. cuids
// são difíceis de adivinhar, mas isso é obscuridade, não autorização. Decisão
// registrada: aceitar o risco por ora e tratar no desenho de autenticação de
// cliente do Painel Admin (ver docs/superpowers/plans/2026-08-04-painel-admin.md).
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

  // Base do reembolso é o que foi de fato cobrado e pago (o sinal, que pode
  // ser qualquer percentual 0-100 de reserva.valorTotal, negociado por
  // telefone via /api/admin/eventos/[id]/sinal), não o valor total do
  // evento — não é possível estornar dinheiro que nunca foi recebido.
  const valorPago = reserva.pagamento ? Number(reserva.pagamento.valor) : 0;
  const valorReembolso = Math.round(valorPago * (percentualReembolso / 100) * 100) / 100;

  if (reserva.pagamento && reserva.pagamento.status === "APROVADO" && valorReembolso > 0) {
    const provider = getPaymentProvider();
    try {
      await provider.estornar(reserva.pagamento.referenciaExterna, valorReembolso);
    } catch (erroEstorno) {
      console.error("falha ao estornar no cancelamento", reserva.id, erroEstorno);
      return NextResponse.json(
        { erro: "não foi possível processar o estorno junto ao provedor de pagamento; tente novamente" },
        { status: 502 }
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
