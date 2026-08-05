import { NextRequest, NextResponse } from "next/server";
import { buscarMesasDisponiveis } from "@/lib/domain/tableAvailability";

export async function GET(request: NextRequest) {
  const ambienteId = request.nextUrl.searchParams.get("ambienteId");
  const dataParam = request.nextUrl.searchParams.get("data");
  const numPessoasParam = request.nextUrl.searchParams.get("numPessoas");

  if (!ambienteId || !dataParam || !numPessoasParam) {
    return NextResponse.json(
      { erro: "parâmetros 'ambienteId', 'data' e 'numPessoas' são obrigatórios" },
      { status: 400 }
    );
  }

  const numPessoas = Number(numPessoasParam);
  if (!Number.isInteger(numPessoas) || numPessoas <= 0) {
    return NextResponse.json(
      { erro: "'numPessoas' deve ser um número inteiro positivo" },
      { status: 400 }
    );
  }

  const data = new Date(`${dataParam}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const mesas = await buscarMesasDisponiveis({ ambienteId, data, numPessoas });
  return NextResponse.json({ mesas });
}
