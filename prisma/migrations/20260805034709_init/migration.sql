-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('DONO', 'RECEPCAO');

-- CreateEnum
CREATE TYPE "StatusReservaMesa" AS ENUM ('CONFIRMADA', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CORPORATIVO', 'ANIVERSARIO', 'JANTAR_RESERVADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusReservaEvento" AS ENUM ('AGUARDANDO_PAGAMENTO', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPagamentoEnum" AS ENUM ('PIX', 'CARTAO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "Ambiente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mattertagRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ambiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "capacidadeLugares" INTEGER NOT NULL,
    "posicaoTour" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "ambienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaMesa" (
    "id" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "nomeCliente" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horarioChegada" TEXT NOT NULL,
    "numPessoas" INTEGER NOT NULL,
    "status" "StatusReservaMesa" NOT NULL DEFAULT 'CONFIRMADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservaMesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pacote" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoPessoa" DECIMAL(10,2),
    "taxaServicoPct" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaEvento" (
    "id" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteTelefone" TEXT NOT NULL,
    "clienteEmail" TEXT NOT NULL,
    "tipoEvento" "TipoEvento" NOT NULL,
    "data" DATE NOT NULL,
    "numConvidados" INTEGER NOT NULL,
    "pacoteId" TEXT,
    "cardapioAberto" BOOLEAN NOT NULL DEFAULT false,
    "equipamentoTelao" BOOLEAN NOT NULL DEFAULT false,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "percentualSinal" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "status" "StatusReservaEvento" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "holdExpiresAt" TIMESTAMP(3),
    "pratosEscolhidos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "reservaEventoId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "metodo" "MetodoPagamentoEnum" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaCancelamento" (
    "id" TEXT NOT NULL,
    "diasMinimos" INTEGER NOT NULL,
    "diasMaximos" INTEGER,
    "percentualReembolso" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "PoliticaCancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ambiente_nome_key" ON "Ambiente"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_ambienteId_numero_key" ON "Mesa"("ambienteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Pacote_nome_key" ON "Pacote"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_reservaEventoId_key" ON "Pagamento"("reservaEventoId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_ambienteId_fkey" FOREIGN KEY ("ambienteId") REFERENCES "Ambiente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaMesa" ADD CONSTRAINT "ReservaMesa_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaEvento" ADD CONSTRAINT "ReservaEvento_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "Pacote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_reservaEventoId_fkey" FOREIGN KEY ("reservaEventoId") REFERENCES "ReservaEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Uma mesa só pode ter uma reserva CONFIRMADA por noite (mesa é do grupo a noite toda).
-- Reservas CANCELADA/NO_SHOW não contam, então a mesa libera para nova reserva.
CREATE UNIQUE INDEX "reserva_mesa_unica_confirmada_por_noite"
ON "ReservaMesa" ("mesaId", "data")
WHERE "status" = 'CONFIRMADA';

-- Só pode existir um evento CONFIRMADO por dia no mezanino.
CREATE UNIQUE INDEX "reserva_evento_unica_confirmada_por_dia"
ON "ReservaEvento" ("data")
WHERE "status" = 'CONFIRMADA';
