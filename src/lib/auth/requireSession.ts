import { auth } from "@/lib/auth";
import { verificarPermissao, type AdminRole } from "./roles";

export class NaoAutenticadoError extends Error {
  constructor() {
    super("sessão não autenticada");
    this.name = "NaoAutenticadoError";
  }
}

export async function exigirSessaoAdmin(
  papeisPermitidos: AdminRole[]
): Promise<{ userId: string; role: AdminRole }> {
  const session = await auth();

  if (!session?.user) {
    throw new NaoAutenticadoError();
  }

  const usuario = session.user as { id?: string; role?: AdminRole };
  if (!usuario.role || !usuario.id) {
    throw new NaoAutenticadoError();
  }

  verificarPermissao(usuario.role, papeisPermitidos);

  return { userId: usuario.id, role: usuario.role };
}
