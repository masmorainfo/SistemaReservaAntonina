import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verificarPermissao, AcessoNegadoError, type AdminRole } from "./roles";

export class NaoAutenticadoError extends Error {
  constructor() {
    super("sessão não autenticada");
    this.name = "NaoAutenticadoError";
  }
}

export interface SessaoAdmin {
  userId: string;
  role: AdminRole;
}

export async function exigirSessaoAdmin(papeisPermitidos: AdminRole[]): Promise<SessaoAdmin> {
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

function respostaDeErroDeAuth(erro: unknown): NextResponse {
  if (erro instanceof NaoAutenticadoError) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }
  if (erro instanceof AcessoNegadoError) {
    return NextResponse.json({ erro: erro.message }, { status: 403 });
  }
  throw erro;
}

/**
 * Envolve um handler de rota (sem segmento dinâmico) exigindo sessão admin
 * com um dos perfis permitidos. Centraliza o try/catch de
 * NaoAutenticadoError/AcessoNegadoError para que a checagem de auth não
 * possa ser esquecida em uma rota nova.
 */
export function comAuthAdmin(
  papeisPermitidos: AdminRole[],
  handler: (request: NextRequest, sessao: SessaoAdmin) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const sessao = await exigirSessaoAdmin(papeisPermitidos);
      return await handler(request, sessao);
    } catch (erro) {
      return respostaDeErroDeAuth(erro);
    }
  };
}

/**
 * Variante de comAuthAdmin para rotas dinâmicas com segmento [id], já que
 * toda rota dinâmica deste projeto usa `{ params: Promise<{ id: string }> }`.
 */
export function comAuthAdminComParams(
  papeisPermitidos: AdminRole[],
  handler: (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
    sessao: SessaoAdmin
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    try {
      const sessao = await exigirSessaoAdmin(papeisPermitidos);
      return await handler(request, context, sessao);
    } catch (erro) {
      return respostaDeErroDeAuth(erro);
    }
  };
}
