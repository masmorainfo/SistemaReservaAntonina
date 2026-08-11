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

// Mesa não tem @@unique([ambienteId, numero]) (é @@index, ver prisma/schema.prisma)
// porque mesas do Deck podem ter o mesmo número em mais de um registro — um por
// configuração de dia da semana (ex.: mesa "11" tem um registro pra terça-quinta+
// domingo e outro, com capacidade diferente, pra sexta/sábado). O identificador
// real de "mesma mesa" pro seed é (ambienteId, numero, diasSemanaAtivos) juntos.
//
// Sempre atualiza capacidade/posição mesmo se já existir — diferente da política
// de "só semeia se vazio" usada pra política de cancelamento, aqui não existe UI
// de admin pra customizar mesa, então não há nada de admin pra proteger; o seed é
// a fonte da verdade e deve convergir pro inventário real a cada rodada.
async function upsertMesa(params: {
  ambienteId: string;
  numero: string;
  capacidadeLugares: number;
  diasSemanaAtivos?: number[];
  posicaoTour?: string;
}): Promise<void> {
  const diasSemanaAtivos = params.diasSemanaAtivos ?? [0, 1, 2, 3, 4, 5, 6];
  const existente = await prisma.mesa.findFirst({
    where: {
      ambienteId: params.ambienteId,
      numero: params.numero,
      diasSemanaAtivos: { equals: diasSemanaAtivos },
    },
  });

  if (existente) {
    await prisma.mesa.update({
      where: { id: existente.id },
      data: {
        capacidadeLugares: params.capacidadeLugares,
        posicaoTour: params.posicaoTour ?? null,
      },
    });
  } else {
    await prisma.mesa.create({
      data: {
        ambienteId: params.ambienteId,
        numero: params.numero,
        capacidadeLugares: params.capacidadeLugares,
        diasSemanaAtivos,
        posicaoTour: params.posicaoTour ?? null,
      },
    });
  }
}

function coordenadas(x: number, y: number, largura: number, altura: number): string {
  return JSON.stringify({ x, y, largura, altura });
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

  // Placeholder de teste antigo, não corresponde a nenhuma mesa real do Deck.
  const d01Mesas = await prisma.mesa.findMany({
    where: { ambienteId: deck.id, numero: "D01" },
  });
  for (const mesa of d01Mesas) {
    await prisma.reservaMesa.deleteMany({ where: { mesaId: mesa.id } });
  }
  await prisma.mesa.deleteMany({ where: { ambienteId: deck.id, numero: "D01" } });

  // Salão Principal — 12 mesas, sem variação por dia da semana.
  // Inventário completo em docs/superpowers/specs/2026-08-11-mapa-2d-mesas-design.md
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "01",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(4.69, 48.33, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "02",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(4.69, 33.89, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "03",
    capacidadeLugares: 6,
    posicaoTour: coordenadas(34.38, 12.22, 8.75, 8.89),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "04",
    capacidadeLugares: 6,
    posicaoTour: coordenadas(45.63, 12.22, 8.75, 8.89),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "05",
    capacidadeLugares: 6,
    posicaoTour: coordenadas(56.88, 12.22, 8.75, 8.89),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "10",
    capacidadeLugares: 12,
    posicaoTour: coordenadas(41.88, 42.22, 16.25, 13.33),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "07",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(80, 24.44, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "06",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(88.75, 24.44, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "18",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(80, 42.22, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "08",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(88.75, 42.22, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "19",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(80, 60, 5.63, 10),
  });
  await upsertMesa({
    ambienteId: salaoPrincipal.id,
    numero: "09",
    capacidadeLugares: 2,
    posicaoTour: coordenadas(88.75, 60, 5.63, 10),
  });

  // Deck — lado esquerdo, terça+quarta+quinta+domingo: 4 mesas de 4 lugares.
  const DIAS_TER_QUA_QUI_DOM = [0, 2, 3, 4];
  const DIAS_SEX_SAB = [5, 6];

  await upsertMesa({
    ambienteId: deck.id,
    numero: "11",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(9.38, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "15",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(21.88, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "12",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(9.38, 55.56, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "14",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(21.88, 55.56, 9.38, 16.67),
  });

  // Deck — lado esquerdo, sexta+sábado: as mesmas 4 mesas se dividem em 6 de 2 lugares.
  await upsertMesa({
    ambienteId: deck.id,
    numero: "11",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(8.75, 32.22, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "12",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(16.88, 32.22, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "16",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(25, 32.22, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "14",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(8.75, 50, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "15",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(16.88, 50, 6.88, 15.56),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "17",
    capacidadeLugares: 2,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(25, 50, 6.88, 15.56),
  });

  // Deck — lado direito, terça+quarta+quinta+domingo: 16 e 17 são exclusivas desses dias.
  await upsertMesa({
    ambienteId: deck.id,
    numero: "16",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(68.75, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "17",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_TER_QUA_QUI_DOM,
    posicaoTour: coordenadas(68.75, 55.56, 9.38, 16.67),
  });

  // Deck — lado direito, 20 e 21 não mudam: mesmo lugar, mesma capacidade, todos os dias.
  await upsertMesa({
    ambienteId: deck.id,
    numero: "21",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(81.25, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "20",
    capacidadeLugares: 4,
    posicaoTour: coordenadas(81.25, 55.56, 9.38, 16.67),
  });

  // Deck — lado direito, sexta+sábado: 22 e 23 ocupam o lugar que 16/17 tinham
  // nos outros dias (suposição documentada no spec — dono ainda não confirmou
  // se é 16->22/17->23 ou o inverso; cosmético, não afeta a lógica de reserva).
  await upsertMesa({
    ambienteId: deck.id,
    numero: "22",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(68.75, 33.33, 9.38, 16.67),
  });
  await upsertMesa({
    ambienteId: deck.id,
    numero: "23",
    capacidadeLugares: 4,
    diasSemanaAtivos: DIAS_SEX_SAB,
    posicaoTour: coordenadas(68.75, 55.56, 9.38, 16.67),
  });

  await upsertMesa({
    ambienteId: mezanino.id,
    numero: "M01",
    capacidadeLugares: 12,
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
