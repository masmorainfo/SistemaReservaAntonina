import { prisma } from "@/lib/db";
import { ReservaEventoWizard } from "./ReservaEventoWizard";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import styles from "./page.module.css";

// Esta página lê dados ao vivo via Prisma (lista de pacotes) a cada
// requisição. Prisma não é uma "dynamic API" do Next.js, então sem essa
// diretiva o `next build` renderizaria a página estaticamente uma única
// vez — congelando os pacotes/preços no build e exigindo banco acessível
// em build time. Mesmo motivo documentado em reservar-mesa/page.tsx.
export const dynamic = "force-dynamic";

export default async function ReservarEventoPage() {
  const pacotes = await prisma.pacote.findMany({ orderBy: { nome: "asc" } });

  return (
    <>
      <SiteNav />
      <main className={styles.pagina}>
        <div className="container">
          <h1 className={styles.titulo}>Reservar Evento</h1>
          <ReservaEventoWizard
            pacotes={pacotes.map((p) => ({
              id: p.id,
              nome: p.nome,
              precoPessoa: p.precoPessoa === null ? null : Number(p.precoPessoa),
              taxaServicoPct: Number(p.taxaServicoPct),
            }))}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
