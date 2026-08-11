// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("renderiza o hero com o nome da marca e a tagline", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Antonina Osteria" })).toBeInTheDocument();
    expect(screen.getByText(/1ª Osteria Tartuferia de Uberlândia/)).toBeInTheDocument();
  });

  it("tem as âncoras de Eventos e Contato que a SiteNav espera", () => {
    render(<HomePage />);
    expect(document.getElementById("eventos")).not.toBeNull();
    expect(document.getElementById("contato")).not.toBeNull();
  });

  it("renderiza os 4 pratos em destaque com link pro cardápio completo", () => {
    render(<HomePage />);
    expect(screen.getByText("Arancini")).toBeInTheDocument();
    expect(screen.getByText("Burrata al Pesto")).toBeInTheDocument();
    expect(screen.getByText("Cacio e Pepe")).toBeInTheDocument();
    expect(screen.getByText("Banoffee Antonina")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver cardápio completo" })).toHaveAttribute(
      "href",
      "https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital"
    );
  });

  it("tem as duas chamadas de reserva com nomes completos", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("link", { name: /Reservar Mesa/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Reservar Evento/i }).length).toBeGreaterThan(0);
  });
});
