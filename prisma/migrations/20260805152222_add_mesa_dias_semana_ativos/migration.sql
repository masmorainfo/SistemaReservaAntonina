-- DropIndex
DROP INDEX "Mesa_ambienteId_numero_key";

-- AlterTable
ALTER TABLE "Mesa" ADD COLUMN     "diasSemanaAtivos" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];

-- CreateIndex
CREATE INDEX "Mesa_ambienteId_numero_idx" ON "Mesa"("ambienteId", "numero");
