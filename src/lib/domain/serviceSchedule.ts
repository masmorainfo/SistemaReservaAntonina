// O restaurante opera em horário de Brasília (America/Sao_Paulo, UTC-3). A
// lógica de "mesmo dia" / corte de horários já passados neste módulo (ver
// `gerarHorariosDisponiveis` abaixo) assume que o processo Node roda no fuso
// horário local do restaurante — o container da aplicação fixa isso via
// `TZ: America/Sao_Paulo` em docker-compose.yml. Quem rodar os testes deste
// módulo ou o servidor de dev fora desse container, num fuso horário local
// diferente, pode ver testes sensíveis a horário de parede (wall-clock)
// se comportarem de forma diferente — não é um bug deste módulo, é uma
// consequência de depender de `new Date()`/hora local do processo.
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface JanelaServico {
  abertura: string;
  limiteReserva: string;
}

export const JANTAR: JanelaServico = { abertura: "18:30", limiteReserva: "19:30" };
export const ALMOCO: JanelaServico = { abertura: "12:00", limiteReserva: "13:00" };

const SEGUNDA = 1;
const DOMINGO = 0;
const SABADO = 6;

export function obterJanelasDeServico(diaSemana: DiaSemana, ehFeriado: boolean): JanelaServico[] {
  if (diaSemana === SEGUNDA) {
    return [];
  }

  const ehFimDeSemanaOuFeriado = diaSemana === DOMINGO || diaSemana === SABADO || ehFeriado;

  return ehFimDeSemanaOuFeriado ? [ALMOCO, JANTAR] : [JANTAR];
}

function paraMinutos(horario: string): number {
  const [horas, minutos] = horario.split(":").map(Number);
  return horas * 60 + minutos;
}

function paraHorario(totalMinutos: number): string {
  const horas = Math.floor(totalMinutos / 60).toString().padStart(2, "0");
  const minutos = (totalMinutos % 60).toString().padStart(2, "0");
  return `${horas}:${minutos}`;
}

function gerarIntervalos(inicio: string, fim: string, passoMinutos = 30): string[] {
  const horarios: string[] = [];
  for (let minutos = paraMinutos(inicio); minutos <= paraMinutos(fim); minutos += passoMinutos) {
    horarios.push(paraHorario(minutos));
  }
  return horarios;
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function gerarHorariosDisponiveis(
  dataReserva: Date,
  agora: Date,
  ehFeriado: boolean
): string[] {
  const diaSemana = dataReserva.getDay() as DiaSemana;
  const janelas = obterJanelasDeServico(diaSemana, ehFeriado);
  const horarios = janelas.flatMap((janela) => gerarIntervalos(janela.abertura, janela.limiteReserva));

  if (!mesmoDia(dataReserva, agora)) {
    return horarios;
  }

  const agoraEmMinutos = agora.getHours() * 60 + agora.getMinutes();
  return horarios.filter((horario) => paraMinutos(horario) > agoraEmMinutos);
}
