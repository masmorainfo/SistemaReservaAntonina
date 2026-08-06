import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PratosInput {
  entradas: string[];
  principais: string[];
  sobremesa: string;
}

function validarInput(body: unknown): body is PratosInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.entradas) &&
    b.entradas.length === 3 &&
    b.entradas.every((e) => typeof e === "string") &&
    Array.isArray(b.principais) &&
    b.principais.length === 4 &&
    b.principais.every((p) => typeof p === "string") &&
    typeof b.sobremesa === "string" &&
    b.sobremesa.length > 0
  );
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 });
  }

  if (!validarInput(body)) {
    return NextResponse.json(
      { erro: "é necessário escolher exatamente 3 entradas, 4 pratos principais e 1 sobremesa" },
      { status: 400 }
    );
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id: params.id } });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "CONFIRMADA") {
    return NextResponse.json(
      { erro: "só é possível escolher os pratos de uma reserva confirmada" },
      { status: 409 }
    );
  }

  const atualizada = await prisma.reservaEvento.update({
    where: { id: params.id },
    data: { pratosEscolhidos: body },
  });

  return NextResponse.json({ reserva: atualizada });
}
