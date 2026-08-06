import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buscarMesasDisponiveis } from "@/lib/domain/tableAvailability";
import { gerarHorariosDisponiveis } from "@/lib/domain/serviceSchedule";

interface CriarReservaMesaInput {
  mesaId: string;
  nomeCliente: string;
  telefone: string;
  data: string;
  horarioChegada: string;
  numPessoas: number;
}

function validarInput(body: unknown): body is CriarReservaMesaInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.mesaId === "string" &&
    b.mesaId.length > 0 &&
    typeof b.nomeCliente === "string" &&
    b.nomeCliente.trim().length > 0 &&
    typeof b.telefone === "string" &&
    b.telefone.trim().length > 0 &&
    typeof b.data === "string" &&
    typeof b.horarioChegada === "string" &&
    typeof b.numPessoas === "number" &&
    b.numPessoas > 0
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo da requisição não é um JSON válido" }, { status: 400 });
  }

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados da reserva inválidos ou incompletos" }, { status: 400 });
  }

  const data = new Date(`${body.data}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const mesa = await prisma.mesa.findUnique({ where: { id: body.mesaId } });
  if (!mesa) {
    return NextResponse.json({ erro: "mesa não encontrada" }, { status: 400 });
  }

  // Revalida no servidor as mesmas regras já aplicadas no caminho de leitura
  // (GET /api/mesas-disponiveis): filtro de diasSemanaAtivos (mesas duplas do
  // Deck), exclusão de mesas já reservadas na data e classificação por
  // capacidade. Sem isso, um cliente poderia POSTar o mesaId do registro de
  // Mesa inativo para o dia da semana da data pedida — essa reserva passaria
  // pelo índice único parcial (que é por linha de Mesa, não por mesa física),
  // ficaria invisível na busca de disponibilidade e não impediria uma segunda
  // reserva confirmada no registro realmente ativo naquele dia, para a mesma
  // mesa física na mesma noite.
  const mesasDisponiveis = await buscarMesasDisponiveis({
    ambienteId: mesa.ambienteId,
    data,
    numPessoas: body.numPessoas,
  });
  const mesaDisponivel = mesasDisponiveis.some((m) => m.id === mesa.id);
  if (!mesaDisponivel) {
    // Mesma mensagem do fallback P2002 abaixo: do ponto de vista do cliente é o
    // mesmo cenário ("essa mesa não pode ser reservada agora"), seja porque já
    // foi reservada, seja porque o registro de Mesa não está ativo para o dia
    // da semana pedido (mesas duplas do Deck).
    return NextResponse.json(
      { erro: "essa mesa acabou de ser reservada para essa data, escolha outra" },
      { status: 409 }
    );
  }

  const feriado = await prisma.feriado.findUnique({ where: { data } });
  const horariosValidos = gerarHorariosDisponiveis(data, new Date(), Boolean(feriado));
  if (!horariosValidos.includes(body.horarioChegada)) {
    return NextResponse.json(
      { erro: "horário de chegada indisponível para essa data" },
      { status: 400 }
    );
  }

  try {
    const reserva = await prisma.reservaMesa.create({
      data: {
        mesaId: body.mesaId,
        nomeCliente: body.nomeCliente.trim(),
        telefone: body.telefone.trim(),
        data,
        horarioChegada: body.horarioChegada,
        numPessoas: body.numPessoas,
        status: "CONFIRMADA",
      },
    });

    return NextResponse.json({ reserva }, { status: 201 });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return NextResponse.json(
        { erro: "essa mesa acabou de ser reservada para essa data, escolha outra" },
        { status: 409 }
      );
    }
    throw erro;
  }
}
