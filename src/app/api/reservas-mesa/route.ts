import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

interface CriarReservaMesaInput {
  mesaId: string;
  nomeCliente: string;
  telefone: string;
  data: string;
  horarioChegada: string;
  numPessoas: number;
}

function validarInput(body: unknown): body is CriarReservaMesaInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.mesaId === "string" &&
    b.mesaId.length > 0 &&
    typeof b.nomeCliente === "string" &&
    b.nomeCliente.trim().length > 0 &&
    typeof b.telefone === "string" &&
    b.telefone.trim().length > 0 &&
    typeof b.data === "string" &&
    typeof b.horarioChegada === "string" &&
    typeof b.numPessoas === "number" &&
    b.numPessoas > 0
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados da reserva inválidos ou incompletos" }, { status: 400 });
  }

  const data = new Date(`${body.data}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  try {
    const reserva = await prisma.reservaMesa.create({
      data: {
        mesaId: body.mesaId,
        nomeCliente: body.nomeCliente.trim(),
        telefone: body.telefone.trim(),
        data,
        horarioChegada: body.horarioChegada,
        numPessoas: body.numPessoas,
        status: "CONFIRMADA",
      },
    });

    return NextResponse.json({ reserva }, { status: 201 });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return NextResponse.json(
        { erro: "essa mesa acabou de ser reservada para essa data, escolha outra" },
        { status: 409 }
      );
    }
    throw erro;
  }
}
