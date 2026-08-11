// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaMesaWizard } from "./ReservaMesaWizard";

describe("ReservaMesaWizard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/horarios-disponiveis")) {
          return new Response(JSON.stringify({ horarios: ["18:30", "19:00"] }), { status: 200 });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );
  });

  it("mostra os horários retornados depois de escolher uma data", async () => {
    render(
      <ReservaMesaWizard
        ambientes={[{ id: "amb_1", nome: "Deck" }]}
        zonasPorAmbiente={{ amb_1: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-11" } });
    fireEvent.click(screen.getByText("Ver horários"));

    await waitFor(() => {
      expect(screen.getByText("18:30")).toBeInTheDocument();
    });
  });

  it("não permite selecionar uma mesa ocupada mesmo simulando o clique", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/horarios-disponiveis")) {
          return new Response(JSON.stringify({ horarios: ["18:30", "19:00"] }), { status: 200 });
        }
        if (url.toString().includes("/api/mesas-disponiveis")) {
          return new Response(
            JSON.stringify({
              mesas: [
                { id: "mesa_livre", numero: "1", capacidadeLugares: 4, faixa: "ideal", ambienteId: "amb_1" },
                { id: "mesa_ocupada", numero: "2", capacidadeLugares: 4, faixa: "ocupada", ambienteId: "amb_1" },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );

    render(
      <ReservaMesaWizard
        ambientes={[{ id: "amb_1", nome: "Deck" }]}
        zonasPorAmbiente={{ amb_1: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-11" } });
    fireEvent.click(screen.getByText("Ver horários"));
    await waitFor(() => {
      expect(screen.getByText("18:30")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByText("Escolher mesa"));

    const botaoOcupada = await screen.findByRole("button", { name: /Mesa 2 — 4 lugares/ });
    expect(botaoOcupada).toBeDisabled();
    expect(botaoOcupada).not.toHaveAttribute("aria-pressed");

    fireEvent.click(botaoOcupada);

    expect(screen.getByText("Continuar")).toBeDisabled();
  });
});

describe("ReservaMesaWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaMesaWizard ambientes={[]} zonasPorAmbiente={{}} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
