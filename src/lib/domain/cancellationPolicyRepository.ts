import { prisma } from "@/lib/db";
import type { PoliticaCancelamentoTier } from "./refundPolicy";

export async function buscarTiersPoliticaCancelamento(): Promise<PoliticaCancelamentoTier[]> {
  const registros = await prisma.politicaCancelamento.findMany({
    orderBy: { diasMinimos: "desc" },
  });

  return registros.map((registro) => ({
    diasMinimos: registro.diasMinimos,
    diasMaximos: registro.diasMaximos,
    percentualReembolso: Number(registro.percentualReembolso),
  }));
}
