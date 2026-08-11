import { prisma } from "@/lib/db";
import { ReservaEventoWizard } from "./ReservaEventoWizard";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import styles from "./page.module.css";

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
