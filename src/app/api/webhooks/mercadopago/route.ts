import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";

export async function POST(request: NextRequest) {
  const assinatura = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";

  if (!assinatura) {
    return NextResponse.json({ erro: "cabeçalho 'x-signature' ausente" }, { status: 401 });
  }

  const dataId = request.nextUrl.searchParams.get("data.id") ?? request.nextUrl.searchParams.get("id") ?? "";

  let corpo: unknown = {};
  try {
    corpo = await request.json();
  } catch {
    // Webhook pode vir com corpo vazio em notificações simples
  }

  const provider = getPaymentProvider();

  let resultadoWebhook;
  try {
    resultadoWebhook = await provider.validarWebhook(
      {
        corpo,
        cabecalhoRequestId: requestId,
        dataId,
      },
      assinatura
    );
  } catch {
    return NextResponse.json({ erro: "assinatura ou notificação inválida" }, { status: 401 });
  }

  const pagamento = await prisma.pagamento.findUnique({
    where: { referenciaExterna: resultadoWebhook.referenciaExterna },
    include: { reservaEvento: true },
  });

  if (!pagamento) {
    // Mercado Pago pode enviar webhooks de pagamentos que não pertencem a esta app
    return NextResponse.json({ ok: true, idIgnorado: resultadoWebhook.referenciaExterna });
  }

  const reserva = pagamento.reservaEvento;

  // Idempotência: se a reserva já não estiver em AGUARDANDO_PAGAMENTO, não altera a reserva
  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        status: resultadoWebhook.status === "aprovado" ? "APROVADO" : "RECUSADO",
      },
    });
    return NextResponse.json({ ok: true, mensagem: "pagamento atualizado, status da reserva inalterado" });
  }

  const agora = new Date();

  if (resultadoWebhook.status === "aprovado") {
    const holdExpirado = reserva.holdExpiresAt && reserva.holdExpiresAt < agora;

    if (holdExpirado) {
      // Pagamento aprovado após a expiração do hold: reserva fica CANCELADA e estorno é solicitado
      await prisma.$transaction([
        prisma.pagamento.update({
          where: { id: pagamento.id },
          data: { status: "APROVADO" },
        }),
        prisma.reservaEvento.update({
          where: { id: reserva.id },
          data: { status: "CANCELADA" },
        }),
      ]);

      try {
        await provider.estornar(pagamento.referenciaExterna, Number(pagamento.valor));
      } catch (erroEstorno) {
        console.error("[Webhook MercadoPago] Erro ao estornar pagamento aprovado após hold expirado:", erroEstorno);
      }

      return NextResponse.json({
        ok: true,
        mensagem: "pagamento aprovado após hold expirado; estorno automático solicitado",
      });
    }

    // Pagamento aprovado dentro do tempo: confirma reserva
    await prisma.$transaction([
      prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: "APROVADO" },
      }),
      prisma.reservaEvento.update({
        where: { id: reserva.id },
        data: { status: "CONFIRMADA", holdExpiresAt: null },
      }),
    ]);

    return NextResponse.json({ ok: true, mensagem: "reserva e pagamento confirmados com sucesso" });
  }

  if (resultadoWebhook.status === "recusado") {
    await prisma.$transaction([
      prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: "RECUSADO" },
      }),
      prisma.reservaEvento.update({
        where: { id: reserva.id },
        data: { status: "CANCELADA" },
      }),
    ]);

    return NextResponse.json({ ok: true, mensagem: "pagamento recusado e reserva cancelada" });
  }

  return NextResponse.json({ ok: true, mensagem: "notificação processada sem alteração de status" });
}
