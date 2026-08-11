// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaEventoWizard } from "./ReservaEventoWizard";
import { NOMES_MESES } from "@/lib/domain/eventCalendarGrid";
import { daquiADias } from "@/test-utils/datas";

function selecionarDataNoCalendario(dataAlvo: Date) {
  const hoje = new Date();
  const mesmoMes =
    dataAlvo.getFullYear() === hoje.getFullYear() && dataAlvo.getMonth() === hoje.getMonth();
  if (!mesmoMes) {
    fireEvent.click(screen.getByLabelText("Próximo mês"));
  }
  const nomeMes = NOMES_MESES[dataAlvo.getMonth()];
  fireEvent.click(
    screen.getByRole("button", { name: `${dataAlvo.getDate()} de ${nomeMes}, disponível` })
  );
}

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

    selecionarDataNoCalendario(daquiADias(10));
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

    selecionarDataNoCalendario(daquiADias(10));
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

    selecionarDataNoCalendario(daquiADias(7));
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

describe("ReservaEventoWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaEventoWizard pacotes={[]} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
