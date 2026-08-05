import { prisma } from "@/lib/db";
import { selecionarMesasParaExibir } from "./tableFit";
import type { MesaDisponivel } from "@/types/reservaMesa";

export async function buscarMesasDisponiveis(params: {
  ambienteId: string;
  data: Date;
  numPessoas: number;
}): Promise<MesaDisponivel[]> {
  const { ambienteId, data, numPessoas } = params;

  const mesasDoAmbiente = await prisma.mesa.findMany({
    where: { ambienteId, ativa: true },
  });

  // Mesas duplas do Deck (11, 12, 21) existem como dois registros de Mesa com o
  // mesmo número, cada um ativo em dias da semana diferentes (ex.: um registro
  // domingo-quinta, outro sexta/sábado). Sem este filtro, os dois apareceriam
  // como disponíveis todos os dias.
  const diaDaSemana = data.getDay();
  const mesasAtivasNoDia = mesasDoAmbiente.filter((mesa) =>
    mesa.diasSemanaAtivos.includes(diaDaSemana)
  );

  const reservasConfirmadas = await prisma.reservaMesa.findMany({
    where: {
      data,
      status: "CONFIRMADA",
      mesaId: { in: mesasAtivasNoDia.map((mesa) => mesa.id) },
    },
    select: { mesaId: true },
  });

  const mesasReservadasIds = new Set(reservasConfirmadas.map((r) => r.mesaId));
  const mesasLivres = mesasAtivasNoDia.filter((mesa) => !mesasReservadasIds.has(mesa.id));

  const classificadas = selecionarMesasParaExibir(
    mesasLivres.map((mesa) => ({ id: mesa.id, capacidadeLugares: mesa.capacidadeLugares })),
    numPessoas
  );

  return classificadas.map((mesaClassificada) => {
    const mesaOriginal = mesasLivres.find((mesa) => mesa.id === mesaClassificada.id)!;
    return {
      ...mesaClassificada,
      numero: mesaOriginal.numero,
      ambienteId: mesaOriginal.ambienteId,
    };
  });
}
