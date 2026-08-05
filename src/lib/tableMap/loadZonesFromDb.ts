import { prisma } from "@/lib/db";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";

export async function carregarZonasDoAmbiente(ambienteId: string): Promise<ZonaClicavel[]> {
  const mesas = await prisma.mesa.findMany({
    where: { ambienteId, ativa: true, posicaoTour: { not: null } },
  });

  return mesas.map((mesa) => {
    const coordenadas = JSON.parse(mesa.posicaoTour as string) as ZonaClicavel["coordenadas"];
    return { mesaId: mesa.id, numero: mesa.numero, coordenadas };
  });
}
