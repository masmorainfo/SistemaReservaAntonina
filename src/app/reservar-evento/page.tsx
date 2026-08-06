import { prisma } from "@/lib/db";
import { ReservaEventoWizard } from "./ReservaEventoWizard";

export default async function ReservarEventoPage() {
  const pacotes = await prisma.pacote.findMany({ orderBy: { nome: "asc" } });

  return (
    <main>
      <h1>Reservar Evento</h1>
      <ReservaEventoWizard
        pacotes={pacotes.map((p) => ({
          id: p.id,
          nome: p.nome,
          precoPessoa: p.precoPessoa === null ? null : Number(p.precoPessoa),
        }))}
      />
    </main>
  );
}
