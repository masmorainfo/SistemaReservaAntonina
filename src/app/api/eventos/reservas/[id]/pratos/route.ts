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

// LIMITAÇÃO CONHECIDA: esta rota não verifica se quem chama é o dono da
// reserva — qualquer pessoa que descubra o id (cuid) pode sobrescrever o
// cardápio escolhido. cuids são difíceis de adivinhar, mas isso é
// obscuridade, não autorização. Decisão registrada: aceitar o risco por ora
// e tratar no desenho de autenticação de cliente do Painel Admin
// (ver docs/superpowers/plans/2026-08-04-painel-admin.md).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const reserva = await prisma.reservaEvento.findUnique({ where: { id } });

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
    where: { id },
    data: {
      pratosEscolhidos: { entradas: body.entradas, principais: body.principais, sobremesa: body.sobremesa },
    },
  });

  return NextResponse.json({ reserva: atualizada });
}
