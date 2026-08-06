// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaEventoWizard } from "./ReservaEventoWizard";

describe("ReservaEventoWizard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/eventos/disponibilidade")) {
          return new Response(JSON.stringify({ disponivel: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );
  });

  it("avança para a etapa de pacote quando a data está disponível", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 197 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2027-09-10" } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });
  });

  it("marca visualmente o rádio selecionado, incluindo o pacote Cardápio Aberto", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 197 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2027-09-10" } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });

    const radioClassico = screen.getByRole("radio", { name: /Clássico/ });
    const radioCardapioAberto = screen.getByRole("radio", { name: /Cardápio Aberto/ });

    fireEvent.click(radioCardapioAberto);
    expect(radioCardapioAberto).toBeChecked();
    expect(radioClassico).not.toBeChecked();

    fireEvent.click(radioClassico);
    expect(radioClassico).toBeChecked();
    expect(radioCardapioAberto).not.toBeChecked();
  });
});
