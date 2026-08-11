// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddonConfirmModal } from "./AddonConfirmModal";

describe("AddonConfirmModal", () => {
  it("não aparece como dialog acessível quando open é false", () => {
    render(
      <AddonConfirmModal
        open={false}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra pacote, add-on e total quando open é true", () => {
    render(
      <AddonConfirmModal
        open={true}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Clássico — R$ 2200.00")).toBeInTheDocument();
    expect(screen.getByText("Telão & Projetor — R$ 500.00")).toBeInTheDocument();
    expect(screen.getByText("Total: R$ 2700.00")).toBeInTheDocument();
  });

  it("chama onConfirm ao clicar em Confirmar", () => {
    const onConfirm = vi.fn();
    render(
      <AddonConfirmModal
        open={true}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    screen.getByRole("button", { name: "Confirmar" }).click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("chama onCancel ao clicar em Cancelar", () => {
    const onCancel = vi.fn();
    render(
      <AddonConfirmModal
        open={true}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    screen.getByRole("button", { name: "Cancelar" }).click();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
