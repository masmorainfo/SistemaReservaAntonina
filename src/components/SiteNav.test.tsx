// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteNav } from "./SiteNav";

describe("SiteNav", () => {
  it("renderiza o nome da marca como link para a home", () => {
    render(<SiteNav />);
    const logo = screen.getByRole("link", { name: "Antonina Osteria" });
    expect(logo).toHaveAttribute("href", "/");
  });

  it("linka Cardápio pro site externo, em nova aba, sem vazar referrer", () => {
    render(<SiteNav />);
    const link = screen.getByRole("link", { name: "Cardápio" });
    expect(link).toHaveAttribute("href", "https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("linka Eventos e Contato para âncoras da home, mesmo em outras páginas", () => {
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/#eventos");
    expect(screen.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "/#contato");
  });

  it("tem os dois atalhos fixos de reserva", () => {
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Mesa" })).toHaveAttribute("href", "/reservar-mesa");
    expect(screen.getByRole("link", { name: "Evento" })).toHaveAttribute("href", "/reservar-evento");
  });
});
