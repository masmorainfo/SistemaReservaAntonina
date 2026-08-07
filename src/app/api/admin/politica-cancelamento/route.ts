import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

interface TierInput {
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: number;
}

function validarTiers(body: unknown): body is TierInput[] {
  if (!Array.isArray(body) || body.length === 0) return false;
  return body.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    return (
      typeof t.diasMinimos === "number" &&
      (t.diasMaximos === null || typeof t.diasMaximos === "number") &&
      typeof t.percentualReembolso === "number"
    );
  });
}

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

  const tiers = await prisma.politicaCancelamento.findMany({ orderBy: { diasMinimos: "desc" } });
  return NextResponse.json({ tiers });
}

export async function PUT(request: NextRequest) {
  try {
    await exigirSessaoAdmin(["DONO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const body = await request.json();
  if (!validarTiers(body)) {
    return NextResponse.json({ erro: "lista de faixas de cancelamento inválida" }, { status: 400 });
  }

  const resultado = await prisma.$transaction([
    prisma.politicaCancelamento.deleteMany(),
    prisma.politicaCancelamento.createMany({ data: body }),
  ]);

  return NextResponse.json({ tiersCriados: resultado[1].count });
}
