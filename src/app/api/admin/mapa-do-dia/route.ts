import { NextResponse } from "next/server";
import { buscarMapaDoDia } from "@/lib/domain/dailyOverview";
import { comAuthAdmin } from "@/lib/auth/requireSession";

export const GET = comAuthAdmin(["DONO", "RECEPCAO"], async (request) => {
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
});
