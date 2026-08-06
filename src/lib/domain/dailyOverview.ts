import { prisma } from "@/lib/db";

export interface ReservaMesaResumo {
  id: string;
  mesaNumero: string;
  ambienteNome: string;
  nomeCliente: string;
  telefone: string;
  horarioChegada: string;
  numPessoas: number;
  status: string;
}

export interface ReservaEventoResumo {
  id: string;
  clienteNome: string;
  tipoEvento: string;
  numConvidados: number;
  valorTotal: number;
  percentualSinal: number;
  status: string;
  pacoteNome: string | null;
}

export async function buscarMapaDoDia(
  data: Date
): Promise<{ mesas: ReservaMesaResumo[]; eventos: ReservaEventoResumo[] }> {
  const reservasMesa = await prisma.reservaMesa.findMany({
    where: { data, status: { not: "CANCELADA" } },
    include: { mesa: { include: { ambiente: true } } },
    orderBy: { horarioChegada: "asc" },
  });

  const reservasEvento = await prisma.reservaEvento.findMany({
    where: { data, status: { not: "CANCELADA" } },
    include: { pacote: true },
  });

  return {
    mesas: reservasMesa.map((r) => ({
      id: r.id,
      mesaNumero: r.mesa.numero,
      ambienteNome: r.mesa.ambiente.nome,
      nomeCliente: r.nomeCliente,
      telefone: r.telefone,
      horarioChegada: r.horarioChegada,
      numPessoas: r.numPessoas,
      status: r.status,
    })),
    eventos: reservasEvento.map((r) => ({
      id: r.id,
      clienteNome: r.clienteNome,
      tipoEvento: r.tipoEvento,
      numConvidados: r.numConvidados,
      valorTotal: Number(r.valorTotal),
      percentualSinal: Number(r.percentualSinal),
      status: r.status,
      pacoteNome: r.pacote?.nome ?? null,
    })),
  };
}
