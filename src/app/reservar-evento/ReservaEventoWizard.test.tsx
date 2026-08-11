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
          { id: "pac_1", nome: "Clássico", precoPessoa: 197, taxaServicoPct: 10 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null, taxaServicoPct: 10 },
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
          { id: "pac_1", nome: "Clássico", precoPessoa: 197, taxaServicoPct: 10 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null, taxaServicoPct: 10 },
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

    render(
      <ReservaEventoWizard
        pacotes={[{ id: "pac_1", nome: "Clássico", precoPessoa: 197, taxaServicoPct: 10 }]}
      />
    );

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

  it("desabilita o add-on de Telão para o pacote Cardápio Aberto e mostra o total correto no modal para um pacote com preço", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 200, taxaServicoPct: 10 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null, taxaServicoPct: 10 },
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

    const checkboxTelao = screen.getByRole("checkbox", { name: /Telão/ });
    expect(checkboxTelao).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Cardápio Aberto/ }));
    expect(checkboxTelao).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Clássico/ }));
    expect(checkboxTelao).not.toBeDisabled();

    fireEvent.click(checkboxTelao);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Clássico — R$ 2200.00")).toBeInTheDocument();
    expect(screen.getByText("Total: R$ 2700.00")).toBeInTheDocument();
  });

  it("não permite numConvidados sair do intervalo válido (1 a 40) via o campo numérico", () => {
    render(<ReservaEventoWizard pacotes={[]} />);
    const campoConvidados = screen.getByLabelText(/Número de convidados/);

    fireEvent.change(campoConvidados, { target: { value: "0" } });
    expect(campoConvidados).toHaveValue(1);

    fireEvent.change(campoConvidados, { target: { value: "" } });
    expect(campoConvidados).toHaveValue(1);

    fireEvent.change(campoConvidados, { target: { value: "999" } });
    expect(campoConvidados).toHaveValue(40);
  });

  it("reseta o add-on de Telão ao trocar de pacote", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 200, taxaServicoPct: 10 },
          { id: "pac_2", nome: "Executivo", precoPessoa: 150, taxaServicoPct: 10 },
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

    fireEvent.click(screen.getByRole("radio", { name: /Clássico/ }));
    const checkboxTelao = screen.getByRole("checkbox", { name: /Telão/ });
    fireEvent.click(checkboxTelao);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(checkboxTelao).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /Executivo/ }));
    expect(checkboxTelao).not.toBeChecked();
    expect(checkboxTelao).not.toBeDisabled();
  });
});

describe("ReservaEventoWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaEventoWizard pacotes={[]} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
