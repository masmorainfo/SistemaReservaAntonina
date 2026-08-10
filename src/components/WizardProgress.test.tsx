// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardProgress } from "./WizardProgress";

const PASSOS = [
  { key: "quando", label: "Quando" },
  { key: "onde", label: "Onde" },
  { key: "dados", label: "Dados" },
];

describe("WizardProgress", () => {
  it("renderiza todas as etapas e marca a atual com aria-current", () => {
    render(<WizardProgress steps={PASSOS} currentKey="onde" />);

    expect(screen.getByText("Quando")).toBeInTheDocument();
    expect(screen.getByText("Onde")).toBeInTheDocument();
    expect(screen.getByText("Dados")).toBeInTheDocument();

    const atual = screen.getByText("Onde").closest("li");
    expect(atual).toHaveAttribute("aria-current", "step");
  });

  it("não marca nenhuma etapa quando currentKey não bate com nenhum passo", () => {
    render(<WizardProgress steps={PASSOS} currentKey="confirmado" />);
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });
});
