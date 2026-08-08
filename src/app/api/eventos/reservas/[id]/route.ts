import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// LIMITAÇÃO CONHECIDA: esta rota não verifica se quem chama é o dono da
// reserva — qualquer pessoa que descubra o id (cuid) pode consultar o
// status. cuids são difíceis de adivinhar, mas isso é obscuridade, não
// autorização. Mesma decisão já registrada nas rotas irmãs (cancelar,
// pagamento, pratos): aceitar o risco por ora, tratar no desenho de
// autenticação de cliente de um trabalho futuro.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reserva = await prisma.reservaEvento.findUnique({
    where: { id },
    include: { pagamento: true },
  });

  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    status: reserva.status,
    pagamento: reserva.pagamento ? { status: reserva.pagamento.status } : null,
  });
}
