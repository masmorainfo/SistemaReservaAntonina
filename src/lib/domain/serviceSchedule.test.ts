import { describe, it, expect } from "vitest";
import { obterJanelasDeServico, gerarHorariosDisponiveis } from "./serviceSchedule";

describe("obterJanelasDeServico", () => {
  it("retorna vazio na segunda-feira (restaurante fechado)", () => {
    expect(obterJanelasDeServico(1, false)).toEqual([]);
  });

  it("retorna só jantar de terça a sexta em dia normal", () => {
    expect(obterJanelasDeServico(2, false)).toEqual([
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });

  it("retorna almoço e jantar no sábado", () => {
    expect(obterJanelasDeServico(6, false)).toEqual([
      { abertura: "12:00", limiteReserva: "13:00" },
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });

  it("retorna almoço e jantar no domingo", () => {
    expect(obterJanelasDeServico(0, false)).toEqual([
      { abertura: "12:00", limiteReserva: "13:00" },
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });

  it("retorna almoço e jantar numa terça-feira marcada como feriado", () => {
    expect(obterJanelasDeServico(2, true)).toEqual([
      { abertura: "12:00", limiteReserva: "13:00" },
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });
});

describe("gerarHorariosDisponiveis", () => {
  it("gera horários de jantar de 30 em 30 minutos numa terça-feira futura", () => {
    const dataReserva = new Date(2026, 7, 11); // terça-feira
    const agora = new Date(2026, 7, 1, 10, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([
      "18:30",
      "19:00",
      "19:30",
    ]);
  });

  it("gera almoço e jantar num sábado futuro", () => {
    const dataReserva = new Date(2026, 7, 8); // sábado
    const agora = new Date(2026, 7, 1, 10, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "18:30",
      "19:00",
      "19:30",
    ]);
  });

  it("retorna vazio numa segunda-feira", () => {
    const dataReserva = new Date(2026, 7, 10); // segunda-feira
    const agora = new Date(2026, 7, 1, 10, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([]);
  });

  it("filtra horários já passados quando a reserva é para hoje", () => {
    const dataReserva = new Date(2026, 7, 11, 0, 0);
    const agora = new Date(2026, 7, 11, 18, 45);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual(["19:00", "19:30"]);
  });

  it("retorna vazio quando hoje já passou de todos os horários", () => {
    const dataReserva = new Date(2026, 7, 11, 0, 0);
    const agora = new Date(2026, 7, 11, 20, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([]);
  });
});
