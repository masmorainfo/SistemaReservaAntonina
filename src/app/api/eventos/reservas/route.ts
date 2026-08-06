import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calcularValorTotalEvento } from "@/lib/domain/eventPricing";
import { dataDisponivelParaEvento } from "@/lib/domain/eventHolds";

const DURACAO_HOLD_MINUTOS = 15;
const TIPOS_EVENTO_VALIDOS = ["CORPORATIVO", "ANIVERSARIO", "JANTAR_RESERVADO", "OUTRO"];

interface CriarReservaEventoInput {
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  tipoEvento: "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
  data: string;
  numConvidados: number;
  pacoteId: string;
  equipamentoTelao: boolean;
}

function validarInput(body: unknown): body is CriarReservaEventoInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.clienteNome === "string" &&
    b.clienteNome.trim().length > 0 &&
    typeof b.clienteTelefone === "string" &&
    b.clienteTelefone.trim().length > 0 &&
    typeof b.clienteEmail === "string" &&
    b.clienteEmail.trim().length > 0 &&
    typeof b.tipoEvento === "string" &&
    TIPOS_EVENTO_VALIDOS.includes(b.tipoEvento) &&
    typeof b.data === "string" &&
    typeof b.numConvidados === "number" &&
    b.numConvidados > 0 &&
    b.numConvidados <= 40 &&
    typeof b.pacoteId === "string" &&
    b.pacoteId.length > 0 &&
    typeof b.equipamentoTelao === "boolean"
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados da reserva de evento inválidos ou incompletos" }, { status: 400 });
  }

  const data = new Date(`${body.data}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const pacote = await prisma.pacote.findUnique({ where: { id: body.pacoteId } });
  if (!pacote || pacote.precoPessoa === null) {
    return NextResponse.json(
      {
        erro:
          "pacote inválido — pacotes sem preço fixo (Cardápio Aberto) não passam por checkout automático, use /api/eventos/orcamento",
      },
      { status: 400 }
    );
  }

  const disponivel = await dataDisponivelParaEvento(data);
  if (!disponivel) {
    return NextResponse.json(
      { erro: "essa data já está reservada ou aguardando pagamento de outro cliente" },
      { status: 409 }
    );
  }

  const valorTotal = calcularValorTotalEvento({
    precoPessoa: Number(pacote.precoPessoa),
    numConvidados: body.numConvidados,
    taxaServicoPct: Number(pacote.taxaServicoPct),
    equipamentoTelao: body.equipamentoTelao,
  });

  try {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: body.clienteNome.trim(),
        clienteTelefone: body.clienteTelefone.trim(),
        clienteEmail: body.clienteEmail.trim(),
        tipoEvento: body.tipoEvento,
        data,
        numConvidados: body.numConvidados,
        pacoteId: body.pacoteId,
        equipamentoTelao: body.equipamentoTelao,
        valorTotal,
        percentualSinal: 100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + DURACAO_HOLD_MINUTOS * 60 * 1000),
      },
    });

    return NextResponse.json({ reserva }, { status: 201 });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return NextResponse.json(
        { erro: "essa data acabou de ser reservada por outro cliente, escolha outra" },
        { status: 409 }
      );
    }
    throw erro;
  }
}
