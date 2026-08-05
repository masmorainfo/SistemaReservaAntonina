import { prisma } from "@/lib/db";
import { FallbackMapProvider } from "@/providers/tableMap/FallbackMapProvider";
import { carregarZonasDoAmbiente } from "@/lib/tableMap/loadZonesFromDb";
import { ReservaMesaWizard } from "./ReservaMesaWizard";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";

export default async function ReservarMesaPage() {
  const ambientes = await prisma.ambiente.findMany({ orderBy: { nome: "asc" } });

  const zonasCarregadas: Record<string, ZonaClicavel[]> = {};
  for (const ambiente of ambientes) {
    zonasCarregadas[ambiente.id] = await carregarZonasDoAmbiente(ambiente.id);
  }

  const mapProvider = new FallbackMapProvider(zonasCarregadas);
  const zonasPorAmbiente: Record<string, ZonaClicavel[]> = {};
  for (const ambiente of ambientes) {
    zonasPorAmbiente[ambiente.id] = await mapProvider.obterZonasClicaveis(ambiente.id);
  }

  return (
    <main>
      <h1>Reservar Mesa</h1>
      <ReservaMesaWizard
        ambientes={ambientes.map((a) => ({ id: a.id, nome: a.nome }))}
        zonasPorAmbiente={zonasPorAmbiente}
      />
    </main>
  );
}
