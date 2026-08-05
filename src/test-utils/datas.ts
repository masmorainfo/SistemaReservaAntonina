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
