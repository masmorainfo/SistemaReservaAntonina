import { describe, it, expect } from "vitest";
import { construirGradeDoMes, NOMES_MESES } from "./eventCalendarGrid";

describe("construirGradeDoMes", () => {
  it("preenche células vazias no início do mês até o primeiro dia da semana correto", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const offsetEsperado = new Date(2027, 8, 1).getDay();
    const celulasVaziasIniciais = grade.slice(0, offsetEsperado);
    expect(celulasVaziasIniciais.every((celula) => celula === null)).toBe(true);
    expect(grade[offsetEsperado]).not.toBeNull();
    expect(grade[offsetEsperado]?.diaDoMes).toBe(1);
  });

  it("inclui todos os dias do mês, com o total de dias preenchidos batendo com o mês", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const diasNoMes = new Date(2027, 9, 0).getDate();
    const diasPreenchidos = grade.filter((celula) => celula !== null);
    expect(diasPreenchidos).toHaveLength(diasNoMes);
  });

  it("marca dias antes de hoje como 'passado'", () => {
    const hoje = new Date(2027, 8, 15);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const dia10 = grade.find((celula) => celula?.diaDoMes === 10);
    expect(dia10?.estado).toBe("passado");
  });

  it("marca o próprio dia de hoje como 'disponivel', não 'passado'", () => {
    const hoje = new Date(2027, 8, 15);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const dia15 = grade.find((celula) => celula?.diaDoMes === 15);
    expect(dia15?.estado).toBe("disponivel");
  });

  it("marca datas presentes em datasOcupadas como 'ocupado'", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: ["2027-09-20"],
      dataSelecionada: "",
    });

    const dia20 = grade.find((celula) => celula?.diaDoMes === 20);
    expect(dia20?.estado).toBe("ocupado");
  });

  it("marca a data selecionada como 'selecionado'", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "2027-09-22",
    });

    const dia22 = grade.find((celula) => celula?.diaDoMes === 22);
    expect(dia22?.estado).toBe("selecionado");
  });
});

describe("NOMES_MESES", () => {
  it("tem 12 nomes de mês em português, começando por janeiro", () => {
    expect(NOMES_MESES).toHaveLength(12);
    expect(NOMES_MESES[0]).toBe("janeiro");
    expect(NOMES_MESES[8]).toBe("setembro");
  });
});
