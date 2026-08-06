import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

interface SinalInput {
  percentualSinal: number;
}

function validarInput(body: unknown): body is SinalInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.percentualSinal === "number" && b.percentualSinal > 0 && b.percentualSinal <= 100;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const { id } = await params;

  const body = await request.json();
  if (!validarInput(body)) {
    return NextResponse.json({ erro: "percentualSinal deve ser um número entre 0 e 100" }, { status: 400 });
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id } });
  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    return NextResponse.json(
      { erro: "só é possível editar o sinal antes do pagamento ser confirmado" },
      { status: 409 }
    );
  }

  const atualizada = await prisma.reservaEvento.update({
    where: { id },
    data: { percentualSinal: body.percentualSinal },
  });

  return NextResponse.json({ reserva: atualizada });
}
