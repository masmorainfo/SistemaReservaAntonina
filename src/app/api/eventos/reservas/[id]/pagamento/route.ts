import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/providers/payment/getPaymentProvider";
import { paraMetodoPagamentoEnum, paraStatusPagamentoEnum } from "@/providers/payment/mappers";
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
  const dataEventoUTC = Date.UTC(dataEvento.getUTCFullYear(), dataEvento.getUTCMonth(), dataEvento.getUTCDate());
  const agoraUTC = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffMs = dataEventoUTC - agoraUTC;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 });
  }

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "método de pagamento inválido" }, { status: 400 });
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id } });

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

  const provider = getPaymentProvider();
  const resultadoPagamento = await provider.iniciarPagamento({
    reservaEventoId: reserva.id,
    valor: valorSinal,
    metodo: body.metodo,
  });

  try {
    if (resultadoPagamento.status === "pendente") {
      const pagamento = await prisma.pagamento.create({
        data: {
          reservaEventoId: reserva.id,
          provedor: resultadoPagamento.provedor,
          metodo: paraMetodoPagamentoEnum(body.metodo),
          valor: valorSinal,
          status: paraStatusPagamentoEnum(resultadoPagamento.status),
          referenciaExterna: resultadoPagamento.referenciaExterna,
        },
      });

      return NextResponse.json(
        { pagamento, reserva, dadosPix: resultadoPagamento.dadosPix },
        { status: 200 }
      );
    }

    const [pagamento, reservaAtualizada] = await prisma.$transaction([
      prisma.pagamento.create({
        data: {
          reservaEventoId: reserva.id,
          provedor: resultadoPagamento.provedor,
          metodo: paraMetodoPagamentoEnum(body.metodo),
          valor: valorSinal,
          status: paraStatusPagamentoEnum(resultadoPagamento.status),
          referenciaExterna: resultadoPagamento.referenciaExterna,
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
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return NextResponse.json(
        {
          erro: "já existe um pagamento registrado para esta reserva; atualize a página antes de tentar novamente",
        },
        { status: 409 }
      );
    }
    throw erro;
  }
}
