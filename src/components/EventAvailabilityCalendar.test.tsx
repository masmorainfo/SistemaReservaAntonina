// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventAvailabilityCalendar } from "./EventAvailabilityCalendar";
import { NOMES_MESES } from "@/lib/domain/eventCalendarGrid";
import { daquiADias } from "@/test-utils/datas";

describe("EventAvailabilityCalendar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ datasOcupadas: [] }), { status: 200 }))
    );
  });

  it("mostra o mês atual ao carregar, com o dia de hoje disponível", async () => {
    render(<EventAvailabilityCalendar value="" onChange={vi.fn()} />);

    const hoje = new Date();
    const nomeMes = NOMES_MESES[hoje.getMonth()];
    expect(screen.getByText(`${nomeMes} de ${hoje.getFullYear()}`)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: `${hoje.getDate()} de ${nomeMes}, disponível` })
      ).toBeInTheDocument();
    });
  });

  it("desabilita o botão de mês anterior quando o mês exibido é o mês atual", () => {
    render(<EventAvailabilityCalendar value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Mês anterior")).toBeDisabled();
  });

  it("marca como ocupado um dia retornado pela API e não permite selecioná-lo", async () => {
    const alvo = daquiADias(5);
    const dataIso = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(alvo.getDate()).padStart(2, "0")}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ datasOcupadas: [dataIso] }), { status: 200 }))
    );

    const onChange = vi.fn();
    render(<EventAvailabilityCalendar value="" onChange={onChange} />);

    const hoje = new Date();
    const mesmoMes = alvo.getFullYear() === hoje.getFullYear() && alvo.getMonth() === hoje.getMonth();
    if (!mesmoMes) {
      fireEvent.click(screen.getByLabelText("Próximo mês"));
    }

    const nomeMes = NOMES_MESES[alvo.getMonth()];
    const botao = await screen.findByRole("button", {
      name: `${alvo.getDate()} de ${nomeMes}, indisponível`,
    });
    expect(botao).toBeDisabled();

    fireEvent.click(botao);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chama onChange com a data no formato YYYY-MM-DD ao clicar num dia disponível", async () => {
    const onChange = vi.fn();
    render(<EventAvailabilityCalendar value="" onChange={onChange} />);

    const hoje = new Date();
    const nomeMes = NOMES_MESES[hoje.getMonth()];
    const botao = await screen.findByRole("button", {
      name: `${hoje.getDate()} de ${nomeMes}, disponível`,
    });
    fireEvent.click(botao);

    const anoEsperado = hoje.getFullYear();
    const mesEsperado = String(hoje.getMonth() + 1).padStart(2, "0");
    const diaEsperado = String(hoje.getDate()).padStart(2, "0");
    expect(onChange).toHaveBeenCalledWith(`${anoEsperado}-${mesEsperado}-${diaEsperado}`);
  });

  it("avança de mês ao clicar em 'Próximo mês' e busca as datas ocupadas do novo mês", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ datasOcupadas: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EventAvailabilityCalendar value="" onChange={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("Próximo mês"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const hoje = new Date();
    const proximoMes = hoje.getMonth() === 11 ? 0 : hoje.getMonth() + 1;
    const anoExibido = hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    expect(screen.getByText(`${NOMES_MESES[proximoMes]} de ${anoExibido}`)).toBeInTheDocument();
  });
});
