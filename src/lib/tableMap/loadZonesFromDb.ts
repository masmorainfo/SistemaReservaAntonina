import { prisma } from "@/lib/db";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";

function isValidCoordenadas(value: unknown): value is ZonaClicavel["coordenadas"] {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.x === "number" &&
    typeof obj.y === "number" &&
    typeof obj.largura === "number" &&
    typeof obj.altura === "number"
  );
}

export async function carregarZonasDoAmbiente(ambienteId: string): Promise<ZonaClicavel[]> {
  const mesas = await prisma.mesa.findMany({
    where: { ambienteId, ativa: true, posicaoTour: { not: null } },
  });

  const zonas: ZonaClicavel[] = [];

  for (const mesa of mesas) {
    try {
      const parsed = JSON.parse(mesa.posicaoTour as string);

      if (!isValidCoordenadas(parsed)) {
        console.warn(
          `[loadZonesFromDb] Skipping mesa ${mesa.id} (${mesa.numero}): posicaoTour has invalid shape`,
          parsed
        );
        continue;
      }

      zonas.push({
        mesaId: mesa.id,
        numero: mesa.numero,
        coordenadas: parsed,
      });
    } catch (error) {
      console.warn(
        `[loadZonesFromDb] Skipping mesa ${mesa.id} (${mesa.numero}): malformed JSON in posicaoTour`,
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }
  }

  return zonas;
}
