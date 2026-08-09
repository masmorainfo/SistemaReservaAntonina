import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  if (provider.nome !== "mercadopago") {
    return NextResponse.json({ erro: "webhook não disponível para este provider" }, { status: 404 });
  }

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
    // updateMany com filtro no status atual torna a transição atômica: sob
    // redeliveries quase simultâneas do mesmo evento, o Postgres serializa
    // os UPDATEs via lock de linha e apenas uma requisição "vence" a corrida
    // (count > 0). Isso evita que duas chamadas concorrentes leiam o mesmo
    // status pendente e disparem estorno em duplicidade.
    const atualizacao = await prisma.pagamento.updateMany({
      where: { id: pagamento.id, status: { not: novoStatusPagamento } },
      data: { status: novoStatusPagamento },
    });

    if (atualizacao.count > 0 && resultado.status === "aprovado" && reserva.status === "CANCELADA") {
      // Dinheiro aprovado depois que o slot já foi liberado — estorna
      // automaticamente, não fica retido por um evento que não vai
      // acontecer. Falha aqui não deve travar o ack do webhook (o
      // Mercado Pago reenviaria indefinidamente); fica registrado para
      // acompanhamento manual.
      try {
        await provider.estornar(resultado.referenciaExterna, Number(pagamento.valor));
        // Registra o estorno na própria reserva — sem isso, um Pagamento
        // APROVADO numa reserva CANCELADA fica indistinguível de um
        // pagamento aprovado que nunca foi estornado, sem nenhuma query
        // capaz de responder "quais estornos automáticos foram feitos?".
        await prisma.reservaEvento.update({
          where: { id: reserva.id },
          data: {
            valorReembolso: Number(pagamento.valor),
            percentualReembolsoAplicado: 100,
          },
        });
      } catch (erroEstorno) {
        console.error("falha ao estornar pagamento tardio", pagamento.id, erroEstorno);
      }
    }

    return NextResponse.json({ ok: true });
  }

  try {
    const [, resultadoUpdateReserva] = await prisma.$transaction([
      prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: novoStatusPagamento },
      }),
      prisma.reservaEvento.updateMany({
        where: { id: reserva.id, status: "AGUARDANDO_PAGAMENTO" },
        data: {
          status: resultado.status === "aprovado" ? "CONFIRMADA" : "CANCELADA",
          holdExpiresAt: null,
        },
      }),
    ]);

    if (resultadoUpdateReserva.count === 0) {
      // A reserva saiu de AGUARDANDO_PAGAMENTO entre a leitura e esta
      // transação (corrida com liberarHoldsExpirados ou com outra entrega do
      // mesmo webhook). O Pagamento já foi marcado acima; se o pagamento foi
      // aprovado mas a reserva não pôde ser confirmada, isso precisa do mesmo
      // tratamento do caso "pagamento tardio" (ver bloco anterior no arquivo)
      // — registrar para acompanhamento manual em vez de silenciosamente
      // deixar dinheiro em um estado ambíguo.
      console.error(
        "reserva saiu de AGUARDANDO_PAGAMENTO durante o processamento do webhook",
        reserva.id,
        pagamento.id
      );
    }
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      // A data já foi ocupada por outra reserva entre a leitura e esta
      // transação (reserva_evento_unica_ativa_por_dia). O Pagamento já não
      // pôde ser marcado nesta transação (ela inteira reverteu) — registra
      // para acompanhamento manual e ainda assim confirma o recebimento do
      // webhook (200), para não entrar em loop de reentregas do Mercado Pago.
      console.error("conflito de data ao confirmar reserva via webhook", reserva.id, erro);
      return NextResponse.json({ ok: true });
    }
    throw erro;
  }

  return NextResponse.json({ ok: true });
}
