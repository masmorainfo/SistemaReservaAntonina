import { NextRequest, NextResponse } from "next/server";
import { dataDisponivelParaEvento } from "@/lib/domain/eventHolds";

export async function GET(request: NextRequest) {
  const dataParam = request.nextUrl.searchParams.get("data");

  if (!dataParam) {
    return NextResponse.json({ erro: "parâmetro 'data' é obrigatório" }, { status: 400 });
  }

  const data = new Date(`${dataParam}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const disponivel = await dataDisponivelParaEvento(data);
  return NextResponse.json({ disponivel });
}
