export const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type EstadoDia = "passado" | "ocupado" | "disponivel" | "selecionado";

export interface DiaGrade {
  data: string;
  diaDoMes: number;
  estado: EstadoDia;
}

export function construirGradeDoMes(params: {
  ano: number;
  mes: number;
  hoje: Date;
  datasOcupadas: string[];
  dataSelecionada: string;
}): (DiaGrade | null)[] {
  const { ano, mes, hoje, datasOcupadas, dataSelecionada } = params;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const celulas: (DiaGrade | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas.push(null);
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataDate = new Date(ano, mes - 1, dia);
    const dataIso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

    let estado: EstadoDia;
    if (dataDate.getTime() < hojeSemHora.getTime()) {
      estado = "passado";
    } else if (dataIso === dataSelecionada) {
      estado = "selecionado";
    } else if (datasOcupadas.includes(dataIso)) {
      estado = "ocupado";
    } else {
      estado = "disponivel";
    }

    celulas.push({ data: dataIso, diaDoMes: dia, estado });
  }

  return celulas;
}
