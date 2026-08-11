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
  // como disponíveis (ou ocupados) todos os dias.
  const diaDaSemana = data.getDay();
  const mesasAtivasNoDia = mesasDoAmbiente.filter((mesa) =>
    mesa.diasSemanaAtivos.includes(diaDaSemana)
  );

  // Mesa pequena demais pro grupo nunca aparece, nem como ocupada.
  const mesasComCapacidade = mesasAtivasNoDia.filter(
    (mesa) => mesa.capacidadeLugares >= numPessoas
  );

  const reservasConfirmadas = await prisma.reservaMesa.findMany({
    where: {
      data,
      status: "CONFIRMADA",
      mesaId: { in: mesasComCapacidade.map((mesa) => mesa.id) },
    },
    select: { mesaId: true },
  });

  const mesasReservadasIds = new Set(reservasConfirmadas.map((r) => r.mesaId));
  const mesasLivres = mesasComCapacidade.filter((mesa) => !mesasReservadasIds.has(mesa.id));
  const mesasOcupadas = mesasComCapacidade.filter((mesa) => mesasReservadasIds.has(mesa.id));

  const classificadas = selecionarMesasParaExibir(
    mesasLivres.map((mesa) => ({ id: mesa.id, capacidadeLugares: mesa.capacidadeLugares })),
    numPessoas
  );

  const mesasLivresClassificadas: MesaDisponivel[] = classificadas.map((mesaClassificada) => {
    const mesaOriginal = mesasLivres.find((mesa) => mesa.id === mesaClassificada.id)!;
    return {
      ...mesaClassificada,
      numero: mesaOriginal.numero,
      ambienteId: mesaOriginal.ambienteId,
    };
  });

  const mesasOcupadasClassificadas: MesaDisponivel[] = mesasOcupadas.map((mesa) => ({
    id: mesa.id,
    capacidadeLugares: mesa.capacidadeLugares,
    faixa: "ocupada",
    numero: mesa.numero,
    ambienteId: mesa.ambienteId,
  }));

  return [...mesasLivresClassificadas, ...mesasOcupadasClassificadas];
}
