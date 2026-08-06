export function proximaTercaFeiraDistante(): string {
  const hoje = new Date();
  const dataFutura = new Date(hoje);
  dataFutura.setDate(hoje.getDate() + 14);

  const TERCA_FEIRA = 2;
  while (dataFutura.getDay() !== TERCA_FEIRA) {
    dataFutura.setDate(dataFutura.getDate() + 1);
  }

  const ano = dataFutura.getFullYear();
  const mes = (dataFutura.getMonth() + 1).toString().padStart(2, "0");
  const dia = dataFutura.getDate().toString().padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function daquiADias(dias: number): Date {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + dias);
  return data;
}
