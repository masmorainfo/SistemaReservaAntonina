import type { $Enums } from "@prisma/client";

// Derivado do enum gerado pelo Prisma (import type é apagado na compilação,
// então não há dependência de runtime). Assim, adicionar um perfil no schema
// quebra o type-check aqui em vez de passar despercebido.
export type AdminRole = $Enums.AdminRole;

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
