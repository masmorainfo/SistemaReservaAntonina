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

  it("não exige ciência do Art. 49 do CDC quando o evento está a exatos 7 dias de distância", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (url.toString().includes("/api/eventos/disponibilidade")) {
          return new Response(JSON.stringify({ disponivel: true }), { status: 200 });
        }
        if (url.toString().endsWith("/api/eventos/reservas") && options?.method === "POST") {
          return new Response(JSON.stringify({ reserva: { id: "res_1", valorTotal: "2200" } }), {
            status: 201,
          });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );

    render(<ReservaEventoWizard pacotes={[{ id: "pac_1", nome: "Clássico", precoPessoa: 197 }]} />);

    const hoje = new Date();
    const dataEvento = new Date(hoje);
    dataEvento.setDate(hoje.getDate() + 7);
    const ano = dataEvento.getFullYear();
    const mes = (dataEvento.getMonth() + 1).toString().padStart(2, "0");
    const dia = dataEvento.getDate().toString().padStart(2, "0");
    const dataStr = `${ano}-${mes}-${dia}`;

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: dataStr } });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /Clássico/ }));
    fireEvent.click(screen.getByText("Continuar para pagamento"));

    await waitFor(() => {
      expect(screen.getByText("Pagamento")).toBeInTheDocument();
    });

    expect(screen.queryByText(/direito de arrependimento/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).not.toBeDisabled();
  });
});
