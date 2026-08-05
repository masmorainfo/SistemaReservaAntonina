import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;

/** Aceita tanto um Decimal do Prisma quanto um number simples. */
type ValorMonetario = Decimal | number;

function ehDecimal(valor: ValorMonetario): valor is Decimal {
  return typeof valor === "object" && valor !== null && typeof valor.toNumber === "function";
}

/**
 * Converte um valor monetário vindo do banco (Decimal) para number,
 * que é o formato usado pelas regras de negócio do domínio.
 */
export function paraNumero(valor: ValorMonetario): number {
  return ehDecimal(valor) ? valor.toNumber() : valor;
}

/** Converte um number do domínio para o Decimal esperado pelo Prisma. */
export function paraDecimal(valor: number): Decimal {
  return new Prisma.Decimal(valor);
}
