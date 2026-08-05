import type { MesaClassificada } from "@/lib/domain/tableFit";

export interface MesaDisponivel extends MesaClassificada {
  numero: string;
  ambienteId: string;
}
