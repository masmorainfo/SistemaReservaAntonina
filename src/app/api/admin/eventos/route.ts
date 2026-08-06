import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

export async function GET(_request: NextRequest) {
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

  const eventos = await prisma.reservaEvento.findMany({
    where: { status: { not: "CANCELADA" } },
    include: { pacote: true, pagamento: true },
    orderBy: { data: "asc" },
  });

  return NextResponse.json({ eventos });
}
