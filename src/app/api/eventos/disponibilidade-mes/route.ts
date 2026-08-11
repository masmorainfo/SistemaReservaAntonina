import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { liberarHoldsExpirados } from "@/lib/domain/eventHolds";

export async function GET(request: NextRequest) {
  const anoParam = request.nextUrl.searchParams.get("ano");
  const mesParam = request.nextUrl.searchParams.get("mes");

  if (!anoParam || !mesParam) {
    return NextResponse.json(
      { erro: "parâmetros 'ano' e 'mes' são obrigatórios" },
      { status: 400 }
    );
  }

  const ano = Number(anoParam);
  const mes = Number(mesParam);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json(
      { erro: "'ano' e 'mes' devem ser números inteiros válidos (mes entre 1 e 12)" },
      { status: 400 }
    );
  }

  await liberarHoldsExpirados();

  const inicioMes = new Date(ano, mes - 1, 1);
  const inicioProximoMes = new Date(ano, mes, 1);

  const reservasNoMes = await prisma.reservaEvento.findMany({
    where: {
      data: { gte: inicioMes, lt: inicioProximoMes },
      status: { in: ["AGUARDANDO_PAGAMENTO", "CONFIRMADA"] },
    },
    select: { data: true },
  });

  const datasOcupadas = reservasNoMes.map((reserva) => {
    const d = reserva.data;
    // Prisma serializa campos @db.Date usando os componentes de data LOCAIS
    // no momento da escrita (ver src/app/api/eventos/reservas/route.ts, que
    // constrói a data via `new Date(`${body.data}T00:00:00`)`), mas devolve o
    // valor lido como meia-noite UTC. Extrair com getUTC*() aqui é o que
    // recupera o Y-M-D original — getters locais deslocariam a data em 1 dia
    // neste fuso (America/Sao_Paulo, UTC-3). Verificado empiricamente contra
    // o banco de teste real.
    const anoStr = d.getUTCFullYear();
    const mesStr = String(d.getUTCMonth() + 1).padStart(2, "0");
    const diaStr = String(d.getUTCDate()).padStart(2, "0");
    return `${anoStr}-${mesStr}-${diaStr}`;
  });

  return NextResponse.json({ datasOcupadas });
}
