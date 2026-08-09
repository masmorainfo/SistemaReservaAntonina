import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";
import { paraStatusPagamentoEnum } from "@/providers/payment/mappers";

export async function POST(request: NextRequest) {
  let corpo: unknown = null;
  try {
    corpo = await request.json();
  } catch {
    // Corpo vazio ou inválido não impede a validação — o Mercado Pago manda
    // o id relevante também na query string (data.id).
  }

  const assinatura = request.headers.get("x-signature") ?? "";
  const cabecalhoRequestId = request.headers.get("x-request-id") ?? "";
  const dataId = request.nextUrl.searchParams.get("data.id") ?? "";

  const provider = getPaymentProvider();

  let resultado;
  try {
    resultado = await provider.validarWebhook({ corpo, cabecalhoRequestId, dataId }, assinatura);
  } catch {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  if (resultado.status === "pendente") {
    return NextResponse.json({ ok: true });
  }

  const pagamento = await prisma.pagamento.findUnique({
    where: { referenciaExterna: resultado.referenciaExterna },
  });

  if (!pagamento) {
    // Notificação de um pagamento que não se origina desta aplicação (ex.:
    // evento de teste disparado pelo próprio painel do Mercado Pago).
    return NextResponse.json({ ok: true });
  }

  const novoStatusPagamento = paraStatusPagamentoEnum(resultado.status);
  const jaProcessadoNesseStatus = pagamento.status === novoStatusPagamento;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id: pagamento.reservaEventoId },
  });

  if (!reserva) {
    return NextResponse.json({ ok: true });
  }

  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    // A reserva já saiu do estado de espera — hold expirou e foi liberado
    // (a reserva vira CANCELADA), já foi confirmada por um webhook anterior,
    // ou isto é a reentrega de uma notificação já processada.
    if (!jaProcessadoNesseStatus) {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: novoStatusPagamento },
      });

      if (resultado.status === "aprovado" && reserva.status === "CANCELADA") {
        // Dinheiro aprovado depois que o slot já foi liberado — estorna
        // automaticamente, não fica retido por um evento que não vai
        // acontecer. Falha aqui não deve travar o ack do webhook (o
        // Mercado Pago reenviaria indefinidamente); fica registrado para
        // acompanhamento manual.
        try {
          await provider.estornar(resultado.referenciaExterna, Number(pagamento.valor));
        } catch (erroEstorno) {
          console.error("falha ao estornar pagamento tardio", pagamento.id, erroEstorno);
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction([
    prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { status: novoStatusPagamento },
    }),
    prisma.reservaEvento.update({
      where: { id: reserva.id },
      data: {
        status: resultado.status === "aprovado" ? "CONFIRMADA" : "CANCELADA",
        holdExpiresAt: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
