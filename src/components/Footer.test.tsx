// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renderiza o endereço e o horário de funcionamento conhecido", () => {
    render(<Footer />);
    expect(screen.getByText(/Rua Vinicius Degani 161/)).toBeInTheDocument();
    expect(screen.getByText(/Terça a Sexta/)).toBeInTheDocument();
  });

  it("linka o Instagram oficial", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: /instagram/i });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/antoninaosteria/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("repete os atalhos de reserva", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Reservar Mesa" })).toHaveAttribute(
      "href",
      "/reservar-mesa"
    );
    expect(screen.getByRole("link", { name: "Reservar Evento" })).toHaveAttribute(
      "href",
      "/reservar-evento"
    );
  });

  it("linka o Cardápio externo, garantindo acesso em telas mobile onde o nav some", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "Cardápio" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("linka a seção de Eventos, garantindo acesso em telas mobile onde o nav some", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute(
      "href",
      "/#eventos"
    );
  });
});
