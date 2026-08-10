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
});

describe("ReservaMesaWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaMesaWizard ambientes={[]} zonasPorAmbiente={{}} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
