import { prisma } from "@/lib/db";
import { verificarSenha } from "./password";
import { AdminRole } from "./roles";
import { estaBloqueado, registrarTentativaFalha, limparTentativas } from "./loginRateLimit";

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
  // Checar e reservar a tentativa acontece em sequência síncrona, sem
  // nenhum await entre as duas chamadas — evita que requisições paralelas
  // passem pela checagem antes de qualquer uma delas registrar sua falha
  // (ver comentário em registrarTentativaFalha). Reservar antes da consulta
  // ao banco/hash de senha também evita gastar esse trabalho numa tentativa
  // já bloqueada.
  if (estaBloqueado(email)) {
    return null;
  }
  registrarTentativaFalha(email);

  const usuario = await prisma.adminUser.findUnique({ where: { email } });

  if (!usuario) {
    // Mesma contagem de falha para e-mail inexistente e senha errada — não
    // dá pra distinguir os dois casos pela resposta, então também não dá
    // pra distinguir pelo comportamento do rate limit. Já contabilizada
    // acima, antes da consulta.
    return null;
  }

  const senhaValida = await verificarSenha(senha, usuario.senhaHash);

  if (!senhaValida) {
    // Já contabilizada acima.
    return null;
  }

  limparTentativas(email);

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
  };
}
