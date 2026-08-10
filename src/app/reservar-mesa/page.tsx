import { prisma } from "@/lib/db";
import { FallbackMapProvider } from "@/providers/tableMap/FallbackMapProvider";
import { carregarZonasDoAmbiente } from "@/lib/tableMap/loadZonesFromDb";
import { ReservaMesaWizard } from "./ReservaMesaWizard";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import styles from "./page.module.css";

// Esta página lê dados ao vivo via Prisma (lista de ambientes, coordenadas do
// mapa) a cada requisição. Prisma não é uma "dynamic API" do Next.js, então
// sem essa diretiva o `next build` renderizaria a página estaticamente uma
// única vez — congelando a lista de ambientes/mesas no build e exigindo banco
// acessível em build time.
export const dynamic = "force-dynamic";

// Mezanino é reservável apenas via o fluxo de Evento (plano futuro): o espaço
// é reconfigurável e não tem mesas fixas individualmente reserváveis no dia a
// dia. Ver docs/superpowers/plans/2026-08-04-reserva-mesa-diaria.md, seção
// "Suposições que este plano assume", item 1.
const AMBIENTE_EXCLUIDO_DA_RESERVA_DIARIA = "Mezanino";

export default async function ReservarMesaPage() {
  const ambientes = await prisma.ambiente.findMany({
    where: { nome: { not: AMBIENTE_EXCLUIDO_DA_RESERVA_DIARIA } },
    orderBy: { nome: "asc" },
  });

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
    <>
      <SiteNav />
      <main className={styles.pagina}>
        <div className="container">
          <h1 className={styles.titulo}>Reservar Mesa</h1>
          <ReservaMesaWizard
            ambientes={ambientes.map((a) => ({ id: a.id, nome: a.nome }))}
            zonasPorAmbiente={zonasPorAmbiente}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
