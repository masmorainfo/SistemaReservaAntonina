import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comAuthAdmin } from "@/lib/auth/requireSession";

interface TierInput {
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: number;
}

function validarTiers(body: unknown): body is TierInput[] {
  if (!Array.isArray(body) || body.length === 0) return false;
  return body.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    const tiposValidos =
      typeof t.diasMinimos === "number" &&
      (t.diasMaximos === null || typeof t.diasMaximos === "number") &&
      typeof t.percentualReembolso === "number";
    if (!tiposValidos) return false;

    const diasMinimos = t.diasMinimos as number;
    const diasMaximos = t.diasMaximos as number | null;
    const percentualReembolso = t.percentualReembolso as number;
    return (
      diasMinimos >= 0 &&
      (diasMaximos === null || diasMaximos >= diasMinimos) &&
      percentualReembolso >= 0 &&
      percentualReembolso <= 100
    );
  });
}

export const GET = comAuthAdmin(["DONO", "RECEPCAO"], async () => {
  const tiers = await prisma.politicaCancelamento.findMany({ orderBy: { diasMinimos: "desc" } });
  return NextResponse.json({ tiers });
});

export const PUT = comAuthAdmin(["DONO"], async (request) => {
  const body = await request.json();
  if (!validarTiers(body)) {
    return NextResponse.json({ erro: "lista de faixas de cancelamento inválida" }, { status: 400 });
  }

  const resultado = await prisma.$transaction([
    prisma.politicaCancelamento.deleteMany(),
    prisma.politicaCancelamento.createMany({
      data: body.map((tier) => ({
        diasMinimos: tier.diasMinimos,
        diasMaximos: tier.diasMaximos,
        percentualReembolso: tier.percentualReembolso,
      })),
    }),
  ]);

  return NextResponse.json({ tiersCriados: resultado[1].count });
});
