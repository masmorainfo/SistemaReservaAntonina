import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const deck = await prisma.ambiente.upsert({
    where: { nome: "Deck" },
    update: {},
    create: { nome: "Deck" },
  });

  const salaoPrincipal = await prisma.ambiente.upsert({
    where: { nome: "Salão Principal" },
    update: {},
    create: { nome: "Salão Principal" },
  });

  const mezanino = await prisma.ambiente.upsert({
    where: { nome: "Mezanino" },
    update: {},
    create: { nome: "Mezanino" },
  });

  await prisma.mesa.upsert({
    where: { ambienteId_numero: { ambienteId: deck.id, numero: "D01" } },
    update: {},
    create: { ambienteId: deck.id, numero: "D01", capacidadeLugares: 4 },
  });

  await prisma.mesa.upsert({
    where: { ambienteId_numero: { ambienteId: salaoPrincipal.id, numero: "03" } },
    update: {},
    create: { ambienteId: salaoPrincipal.id, numero: "03", capacidadeLugares: 6 },
  });

  await prisma.mesa.upsert({
    where: { ambienteId_numero: { ambienteId: mezanino.id, numero: "M01" } },
    update: {},
    create: { ambienteId: mezanino.id, numero: "M01", capacidadeLugares: 12 },
  });

  await prisma.pacote.upsert({
    where: { nome: "Clássico" },
    update: {},
    create: { nome: "Clássico", precoPessoa: 197.0, taxaServicoPct: 10.0 },
  });

  await prisma.pacote.upsert({
    where: { nome: "Premium" },
    update: {},
    create: { nome: "Premium", precoPessoa: 250.0, taxaServicoPct: 10.0 },
  });

  await prisma.pacote.upsert({
    where: { nome: "L'Esperienza" },
    update: {},
    create: { nome: "L'Esperienza", precoPessoa: 297.0, taxaServicoPct: 10.0 },
  });

  await prisma.pacote.upsert({
    where: { nome: "Cardápio Aberto" },
    update: {},
    create: { nome: "Cardápio Aberto", precoPessoa: null, taxaServicoPct: 10.0 },
  });

  const tiers: Array<{ diasMinimos: number; diasMaximos: number | null; percentualReembolso: number }> = [
    { diasMinimos: 15, diasMaximos: null, percentualReembolso: 100 },
    { diasMinimos: 8, diasMaximos: 14, percentualReembolso: 75 },
    { diasMinimos: 4, diasMaximos: 7, percentualReembolso: 50 },
    { diasMinimos: 2, diasMaximos: 3, percentualReembolso: 25 },
    { diasMinimos: 0, diasMaximos: 1, percentualReembolso: 0 },
  ];

  await prisma.politicaCancelamento.deleteMany();
  await prisma.politicaCancelamento.createMany({ data: tiers });

  const senhaHash = await bcrypt.hash("trocar-esta-senha", 10);
  await prisma.adminUser.upsert({
    where: { email: "dono@antoninaosteria.com" },
    update: {},
    create: {
      nome: "Dono Antonina Osteria",
      email: "dono@antoninaosteria.com",
      senhaHash,
      role: "DONO",
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
