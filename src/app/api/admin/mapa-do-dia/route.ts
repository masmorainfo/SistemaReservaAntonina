import { NextRequest, NextResponse } from "next/server";
import { buscarMapaDoDia } from "@/lib/domain/dailyOverview";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const dataParam = request.nextUrl.searchParams.get("data");
  if (!dataParam) {
    return NextResponse.json({ erro: "parâmetro 'data' é obrigatório" }, { status: 400 });
  }

  const data = new Date(`${dataParam}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const mapa = await buscarMapaDoDia(data);
  return NextResponse.json(mapa);
}
