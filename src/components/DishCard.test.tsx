// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DishCard } from "./DishCard";

describe("DishCard", () => {
  it("renderiza nome, descrição e imagem com alt, sem preço", () => {
    render(
      <DishCard
        nome="Arancini"
        descricao="Bolinho de risoto com molho de tomate pelado recheado com queijo."
        imagemSrc="/images/prato-arancini.jpg"
        imagemAlt="Arancini servido em prato de madeira"
      />
    );

    expect(screen.getByText("Arancini")).toBeInTheDocument();
    expect(screen.getByText(/Bolinho de risoto/)).toBeInTheDocument();
    expect(screen.getByAltText("Arancini servido em prato de madeira")).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });
});
