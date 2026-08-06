import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { exigirSessaoAdmin, NaoAutenticadoError } from "./requireSession";
import { AcessoNegadoError } from "./roles";

describe("exigirSessaoAdmin", () => {
  it("lança NaoAutenticadoError quando não há sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    await expect(exigirSessaoAdmin(["DONO"])).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança AcessoNegadoError quando o perfil não está entre os permitidos", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    await expect(exigirSessaoAdmin(["DONO"])).rejects.toThrow(AcessoNegadoError);
  });

  it("retorna os dados da sessão quando o perfil é permitido", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "DONO" } } as never);
    const resultado = await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
    expect(resultado).toEqual({ userId: "u1", role: "DONO" });
  });
});
