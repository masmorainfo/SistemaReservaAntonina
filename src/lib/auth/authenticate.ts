import { prisma } from "@/lib/db";
import { verificarSenha } from "./password";
import { AdminRole } from "./roles";

export interface AdminSessionData {
  id: string;
  nome: string;
  email: string;
  role: AdminRole;
}

export async function autenticarAdmin(
  email: string,
  senha: string
): Promise<AdminSessionData | null> {
  const usuario = await prisma.adminUser.findUnique({ where: { email } });

  if (!usuario) {
    return null;
  }

  const senhaValida = await verificarSenha(senha, usuario.senhaHash);

  if (!senhaValida) {
    return null;
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role as AdminRole,
  };
}
