import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const reserva = await prisma.reservaMesa.findUnique({ where: { id } });
  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  const atualizada = await prisma.reservaMesa.update({
    where: { id },
    data: { status: "CANCELADA" },
  });

  return NextResponse.json({ reserva: atualizada });
}
