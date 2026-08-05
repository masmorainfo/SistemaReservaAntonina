import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../src/lib/auth/password";
import { POLITICA_CANCELAMENTO_PADRAO } from "../src/lib/domain/refundPolicy";

const prisma = new PrismaClient();

const SENHA_ADMIN_FALLBACK_DEV = "trocar-esta-senha";

function obterSenhaAdmin(): string {
  const senha = process.env.SEED_ADMIN_SENHA;

  if (senha) {
    return senha;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SEED_ADMIN_SENHA é obrigatória em produção. Defina a variável de ambiente antes de rodar o seed."
    );
  }

  return SENHA_ADMIN_FALLBACK_DEV;
}

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

  // A política é editável pelo admin sem deploy; só semeia se estiver vazia,
  // para não sobrescrever customizações ao rodar o seed novamente.
  const politicasExistentes = await prisma.politicaCancelamento.count();

  if (politicasExistentes === 0) {
    await prisma.politicaCancelamento.createMany({ data: POLITICA_CANCELAMENTO_PADRAO });
  } else {
    console.log("Política de cancelamento já configurada — mantida sem alterações.");
  }

  const senhaHash = await hashSenha(obterSenhaAdmin());
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
