-- AlterTable
ALTER TABLE "ReservaEvento" ADD COLUMN     "cienciaDireitoArrependimento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "percentualReembolsoAplicado" DECIMAL(5,2),
ADD COLUMN     "valorReembolso" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "PedidoOrcamento" (
    "id" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteTelefone" TEXT NOT NULL,
    "clienteEmail" TEXT NOT NULL,
    "tipoEvento" "TipoEvento" NOT NULL,
    "dataDesejada" DATE NOT NULL,
    "numConvidados" INTEGER NOT NULL,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoOrcamento_pkey" PRIMARY KEY ("id")
);

-- Substitui o índice da Fundação (que só cobria CONFIRMADA) por um mais amplo:
-- no máximo UMA reserva "ativa" (aguardando pagamento OU confirmada) por dia.
-- Isso é o que garante o hold de 15 minutos contra dupla reserva no nível do banco.
DROP INDEX IF EXISTS "reserva_evento_unica_confirmada_por_dia";

CREATE UNIQUE INDEX "reserva_evento_unica_ativa_por_dia"
ON "ReservaEvento" ("data")
WHERE "status" IN ('AGUARDANDO_PAGAMENTO', 'CONFIRMADA');
