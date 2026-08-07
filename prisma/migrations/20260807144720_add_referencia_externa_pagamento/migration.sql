-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "referenciaExterna" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_referenciaExterna_key" ON "Pagamento"("referenciaExterna");
