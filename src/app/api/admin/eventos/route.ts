import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comAuthAdmin } from "@/lib/auth/requireSession";

export const GET = comAuthAdmin(["DONO", "RECEPCAO"], async () => {
  const eventos = await prisma.reservaEvento.findMany({
    where: { status: { not: "CANCELADA" } },
    include: { pacote: true, pagamento: true },
    orderBy: { data: "asc" },
  });

  return NextResponse.json({ eventos });
});
