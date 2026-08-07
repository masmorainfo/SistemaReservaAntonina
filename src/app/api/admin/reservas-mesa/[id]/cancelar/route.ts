import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comAuthAdminComParams } from "@/lib/auth/requireSession";

export const POST = comAuthAdminComParams(["DONO", "RECEPCAO"], async (_request, { params }) => {
  const { id } = await params;

  const reserva = await prisma.reservaMesa.findUnique({ where: { id } });
  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  const atualizada = await prisma.reservaMesa.update({
    where: { id },
    data: { status: "CANCELADA" },
  });

  return NextResponse.json({ reserva: atualizada });
});
