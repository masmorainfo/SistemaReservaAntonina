import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comAuthAdminComParams } from "@/lib/auth/requireSession";

interface SinalInput {
  percentualSinal: number;
}

function validarInput(body: unknown): body is SinalInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.percentualSinal === "number" && b.percentualSinal > 0 && b.percentualSinal <= 100;
}

export const PATCH = comAuthAdminComParams(["DONO", "RECEPCAO"], async (request, { params }) => {
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
});
