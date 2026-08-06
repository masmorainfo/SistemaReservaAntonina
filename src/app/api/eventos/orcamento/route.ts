import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PedidoOrcamentoInput {
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  tipoEvento: "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
  dataDesejada: string;
  numConvidados: number;
  observacoes?: string;
}

const TIPOS_EVENTO_VALIDOS = ["CORPORATIVO", "ANIVERSARIO", "JANTAR_RESERVADO", "OUTRO"];

function validarInput(body: unknown): body is PedidoOrcamentoInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.clienteNome === "string" &&
    b.clienteNome.trim().length > 0 &&
    typeof b.clienteTelefone === "string" &&
    b.clienteTelefone.trim().length > 0 &&
    typeof b.clienteEmail === "string" &&
    b.clienteEmail.trim().length > 0 &&
    typeof b.tipoEvento === "string" &&
    TIPOS_EVENTO_VALIDOS.includes(b.tipoEvento) &&
    typeof b.dataDesejada === "string" &&
    typeof b.numConvidados === "number" &&
    b.numConvidados > 0 &&
    (b.observacoes === undefined || typeof b.observacoes === "string")
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 });
  }

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados do pedido de orçamento inválidos ou incompletos" }, { status: 400 });
  }

  const dataDesejada = new Date(`${body.dataDesejada}T00:00:00`);
  if (Number.isNaN(dataDesejada.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'dataDesejada' inválido" }, { status: 400 });
  }

  const pedido = await prisma.pedidoOrcamento.create({
    data: {
      clienteNome: body.clienteNome.trim(),
      clienteTelefone: body.clienteTelefone.trim(),
      clienteEmail: body.clienteEmail.trim(),
      tipoEvento: body.tipoEvento,
      dataDesejada,
      numConvidados: body.numConvidados,
      observacoes: body.observacoes?.trim(),
    },
  });

  return NextResponse.json({ pedido }, { status: 201 });
}
