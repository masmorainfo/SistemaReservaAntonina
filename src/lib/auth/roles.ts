export type AdminRole = "DONO" | "RECEPCAO";

export class AcessoNegadoError extends Error {
  constructor(role: AdminRole, permitido: AdminRole[]) {
    super(`Acesso negado: perfil ${role} não está entre os permitidos (${permitido.join(", ")})`);
    this.name = "AcessoNegadoError";
  }
}

export function verificarPermissao(role: AdminRole, permitido: AdminRole[]): void {
  if (!permitido.includes(role)) {
    throw new AcessoNegadoError(role, permitido);
  }
}
