import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MockPaymentProvider } from "@/providers/payment/MockPaymentProvider";
import type { MetodoPagamento } from "@/providers/payment/PaymentProvider";

const DIAS_LIMITE_DIREITO_ARREPENDIMENTO = 7;

interface PagamentoInput {
  metodo: MetodoPagamento;
  cienciaDireitoArrependimento?: boolean;
}

function validarInput(body: unknown): body is PagamentoInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return b.metodo === "pix" || b.metodo === "cartao";
}

function diasAteEvento(dataEvento: Date, agora: Date): number {
  const diffMs = dataEvento.getTime() - agora.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 });
  }

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "método de pagamento inválido" }, { status: 400 });
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id: params.id } });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    return NextResponse.json({ erro: "essa reserva não está aguardando pagamento" }, { status: 409 });
  }

  if (reserva.holdExpiresAt && reserva.holdExpiresAt < new Date()) {
    await prisma.reservaEvento.update({ where: { id: reserva.id }, data: { status: "CANCELADA" } });
    return NextResponse.json(
      { erro: "o tempo para concluir o pagamento expirou, comece a reserva novamente" },
      { status: 410 }
    );
  }

  const dias = diasAteEvento(reserva.data, new Date());
  if (dias < DIAS_LIMITE_DIREITO_ARREPENDIMENTO && !body.cienciaDireitoArrependimento) {
    return NextResponse.json(
      {
        erro:
          "para eventos com menos de 7 dias de antecedência, é necessário confirmar ciência sobre o direito de arrependimento (Art. 49 do CDC)",
      },
      { status: 400 }
    );
  }

  const valorSinal =
    Math.round(Number(reserva.valorTotal) * (Number(reserva.percentualSinal) / 100) * 100) / 100;

  const provider = new MockPaymentProvider();
  const resultadoPagamento = await provider.iniciarPagamento({
    reservaEventoId: reserva.id,
    valor: valorSinal,
    metodo: body.metodo,
  });

  const [pagamento, reservaAtualizada] = await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        reservaEventoId: reserva.id,
        provedor: resultadoPagamento.provedor,
        metodo: body.metodo === "pix" ? "PIX" : "CARTAO",
        valor: valorSinal,
        status: resultadoPagamento.status === "aprovado" ? "APROVADO" : "RECUSADO",
      },
    }),
    prisma.reservaEvento.update({
      where: { id: reserva.id },
      data: {
        status: resultadoPagamento.status === "aprovado" ? "CONFIRMADA" : "CANCELADA",
        holdExpiresAt: null,
        cienciaDireitoArrependimento: Boolean(body.cienciaDireitoArrependimento),
      },
    }),
  ]);

  return NextResponse.json({ pagamento, reserva: reservaAtualizada }, { status: 200 });
}
