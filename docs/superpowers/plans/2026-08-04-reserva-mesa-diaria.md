# Reserva de Mesa Diária — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o fluxo completo de reserva de mesa diária — do cliente escolher data/horário/número de pessoas até navegar pelos ambientes, escolher uma mesa específica e confirmar a reserva — sobre a base criada no plano de Fundação Técnica.

**Architecture:** Route Handlers do Next.js (App Router) para leitura de disponibilidade e criação de reserva; um componente client-side único conduzindo o fluxo em etapas (quando → onde → dados → confirmado); consulta de disponibilidade combinando a regra de faixa de encaixe da Fundação com exclusão de mesas já reservadas no banco; a trava real contra dupla reserva já existe no índice único parcial criado na Fundação — este plano só precisa tratar o erro que o Postgres devolve quando ela dispara.

**Tech Stack:** Next.js Route Handlers · Prisma · React (client component) · Vitest + Testing Library · Playwright (E2E)

## Pré-requisito

Este plano assume que o plano `2026-08-04-fundacao-tecnica.md` já foi executado e verificado (checklist final daquele plano passando).

## Global Constraints

Herda todas as constraints do plano de Fundação. Adicionalmente:
- Toda rota HTTP nova é um **Route Handler** (`route.ts`), não Server Action — mantém consistência com `/api/health` e `/api/auth` já existentes.
- Nenhum teste pode depender de uma data calendário fixa combinada com `new Date()` real sem controle — datas de teste que interagem com "hoje" devem ser calculadas em tempo de execução do teste (ver `src/test-utils/datas.ts`), nunca strings de data hardcoded, para o plano não expirar silenciosamente com o tempo.

## Suposições que este plano assume (confirmar com o restaurante antes de operar em produção)

1. **Mezanino não participa da reserva de mesa diária** — é reservável apenas via o fluxo de Evento (plano futuro), porque o espaço é reconfigurável e não tem mesas fixas individualmente reserváveis no dia a dia. Este plano só lista mesas de ambientes marcados como parte do fluxo diário (na prática, todos os ambientes cadastrados exceto o Mezanino — a UI deste plano lista todos os `Ambiente` do banco, então **não cadastre o Mezanino como opção visível aqui**, ou adicione um campo de exclusão se ele precisar aparecer).
2. **Feriado que cai numa segunda-feira mantém o restaurante fechado** — a regra de segunda-feira fechada tem precedência sobre a liberação de almoço por feriado. Ajustável depois se a operação real for diferente.
3. **Coordenadas das zonas clicáveis do mapa são ilustrativas** — este plano usa o campo `posicaoTour` da `Mesa` (JSON com `x, y, largura, altura` em **porcentagem** da imagem, não pixels, para funcionar em qualquer tamanho de tela) mas os valores reais precisam ser calibrados contra as imagens definitivas do restaurante — isso é trabalho operacional, não bloqueia a implementação.
4. **Horário de funcionamento** (confirmado com o cliente): segunda-feira fechado; terça a sexta, jantar das 18:30 às 19:30 (reserva); sábado, domingo e feriado, almoço das 12:00 às 13:00 e jantar das 18:30 às 19:30 (reserva). Intervalo de horários oferecidos: 30 em 30 minutos.

## Visão geral dos arquivos

```
prisma/
  schema.prisma                          (modificado — adiciona model Feriado)
src/
  lib/
    domain/
      serviceSchedule.ts                 (novo)
      tableAvailability.ts               (novo)
    tableMap/
      loadZonesFromDb.ts                 (novo)
  types/
    reservaMesa.ts                       (novo — DTOs client-safe)
  test-utils/
    datas.ts                             (novo)
  app/
    api/
      horarios-disponiveis/route.ts      (novo)
      mesas-disponiveis/route.ts         (novo)
      reservas-mesa/route.ts             (novo)
    reservar-mesa/
      page.tsx                           (novo)
      ReservaMesaWizard.tsx              (novo)
vitest.config.ts                         (modificado — plugin React + jsdom para testes de componente)
vitest.setup.ts                          (novo)
playwright.config.ts                     (novo)
e2e/
  reserva-mesa.spec.ts                   (novo)
```

---

### Task 1: Domain — janelas de serviço e horários disponíveis

**Files:**
- Create: `src/lib/domain/serviceSchedule.ts`
- Test: `src/lib/domain/serviceSchedule.test.ts`

**Interfaces:**
- Produces: `obterJanelasDeServico(diaSemana, ehFeriado)`, `gerarHorariosDisponiveis(dataReserva, agora, ehFeriado)`, tipos `DiaSemana`, `JanelaServico`.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/domain/serviceSchedule.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { obterJanelasDeServico, gerarHorariosDisponiveis } from "./serviceSchedule";

describe("obterJanelasDeServico", () => {
  it("retorna vazio na segunda-feira (restaurante fechado)", () => {
    expect(obterJanelasDeServico(1, false)).toEqual([]);
  });

  it("retorna só jantar de terça a sexta em dia normal", () => {
    expect(obterJanelasDeServico(2, false)).toEqual([
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });

  it("retorna almoço e jantar no sábado", () => {
    expect(obterJanelasDeServico(6, false)).toEqual([
      { abertura: "12:00", limiteReserva: "13:00" },
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });

  it("retorna almoço e jantar no domingo", () => {
    expect(obterJanelasDeServico(0, false)).toEqual([
      { abertura: "12:00", limiteReserva: "13:00" },
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });

  it("retorna almoço e jantar numa terça-feira marcada como feriado", () => {
    expect(obterJanelasDeServico(2, true)).toEqual([
      { abertura: "12:00", limiteReserva: "13:00" },
      { abertura: "18:30", limiteReserva: "19:30" },
    ]);
  });
});

describe("gerarHorariosDisponiveis", () => {
  it("gera horários de jantar de 30 em 30 minutos numa terça-feira futura", () => {
    const dataReserva = new Date(2026, 7, 11); // terça-feira
    const agora = new Date(2026, 7, 1, 10, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([
      "18:30",
      "19:00",
      "19:30",
    ]);
  });

  it("gera almoço e jantar num sábado futuro", () => {
    const dataReserva = new Date(2026, 7, 8); // sábado
    const agora = new Date(2026, 7, 1, 10, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "18:30",
      "19:00",
      "19:30",
    ]);
  });

  it("retorna vazio numa segunda-feira", () => {
    const dataReserva = new Date(2026, 7, 10); // segunda-feira
    const agora = new Date(2026, 7, 1, 10, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([]);
  });

  it("filtra horários já passados quando a reserva é para hoje", () => {
    const dataReserva = new Date(2026, 7, 11, 0, 0);
    const agora = new Date(2026, 7, 11, 18, 45);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual(["19:00", "19:30"]);
  });

  it("retorna vazio quando hoje já passou de todos os horários", () => {
    const dataReserva = new Date(2026, 7, 11, 0, 0);
    const agora = new Date(2026, 7, 11, 20, 0);
    expect(gerarHorariosDisponiveis(dataReserva, agora, false)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- serviceSchedule`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/serviceSchedule.ts`:
```ts
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface JanelaServico {
  abertura: string;
  limiteReserva: string;
}

export const JANTAR: JanelaServico = { abertura: "18:30", limiteReserva: "19:30" };
export const ALMOCO: JanelaServico = { abertura: "12:00", limiteReserva: "13:00" };

const SEGUNDA = 1;
const DOMINGO = 0;
const SABADO = 6;

export function obterJanelasDeServico(diaSemana: DiaSemana, ehFeriado: boolean): JanelaServico[] {
  if (diaSemana === SEGUNDA) {
    return [];
  }

  const ehFimDeSemanaOuFeriado = diaSemana === DOMINGO || diaSemana === SABADO || ehFeriado;

  return ehFimDeSemanaOuFeriado ? [ALMOCO, JANTAR] : [JANTAR];
}

function paraMinutos(horario: string): number {
  const [horas, minutos] = horario.split(":").map(Number);
  return horas * 60 + minutos;
}

function paraHorario(totalMinutos: number): string {
  const horas = Math.floor(totalMinutos / 60).toString().padStart(2, "0");
  const minutos = (totalMinutos % 60).toString().padStart(2, "0");
  return `${horas}:${minutos}`;
}

function gerarIntervalos(inicio: string, fim: string, passoMinutos = 30): string[] {
  const horarios: string[] = [];
  for (let minutos = paraMinutos(inicio); minutos <= paraMinutos(fim); minutos += passoMinutos) {
    horarios.push(paraHorario(minutos));
  }
  return horarios;
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function gerarHorariosDisponiveis(
  dataReserva: Date,
  agora: Date,
  ehFeriado: boolean
): string[] {
  const diaSemana = dataReserva.getDay() as DiaSemana;
  const janelas = obterJanelasDeServico(diaSemana, ehFeriado);
  const horarios = janelas.flatMap((janela) => gerarIntervalos(janela.abertura, janela.limiteReserva));

  if (!mesmoDia(dataReserva, agora)) {
    return horarios;
  }

  const agoraEmMinutos = agora.getHours() * 60 + agora.getMinutes();
  return horarios.filter((horario) => paraMinutos(horario) > agoraEmMinutos);
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- serviceSchedule`
Expected: PASS (10 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/serviceSchedule.ts src/lib/domain/serviceSchedule.test.ts
git commit -m "feat: regra de janelas de serviço e geração de horários disponíveis"
```

---

### Task 2: Schema — modelo Feriado

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: modelo `Feriado` (`data` única, `nome`), usado pela rota de horários (Task 4).

- [ ] **Step 1: Adicionar o modelo ao schema**

Acrescente ao final de `prisma/schema.prisma`:
```prisma
model Feriado {
  id   String   @id @default(cuid())
  data DateTime @unique @db.Date
  nome String
}
```

- [ ] **Step 2: Gerar e aplicar a migração**

Run: `docker compose up -d db`
Run: `npx prisma migrate dev --name add_feriado`
Expected: migração aplicada sem erro.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: adiciona modelo Feriado ao schema"
```

---

### Task 3: Domain — consulta de mesas disponíveis

**Files:**
- Create: `src/types/reservaMesa.ts`
- Create: `src/lib/domain/tableAvailability.ts`
- Test: `src/lib/domain/tableAvailability.test.ts`

**Interfaces:**
- Consumes: `selecionarMesasParaExibir` (Fundação, `src/lib/domain/tableFit.ts`), `prisma` (Fundação).
- Produces: tipo `MesaDisponivel` (client-safe, sem import de Prisma — importado depois pelo componente client no Task 8), `buscarMesasDisponiveis(params)`.

**Por que o tipo fica em `src/types/` e não junto da função:** `tableAvailability.ts` importa `prisma`, que é server-only. Se o componente client (Task 8) importasse o tipo direto de `tableAvailability.ts`, o bundler tentaria incluir o Prisma Client no bundle do navegador e quebraria o build. Mantendo o tipo num arquivo sem nenhum import de servidor, tanto o lado servidor quanto o cliente importam o mesmo tipo sem conflito.

- [ ] **Step 1: Criar o tipo compartilhado**

`src/types/reservaMesa.ts`:
```ts
import type { MesaClassificada } from "@/lib/domain/tableFit";

export interface MesaDisponivel extends MesaClassificada {
  numero: string;
  ambienteId: string;
}
```

- [ ] **Step 2: Escrever o teste que falha**

`src/lib/domain/tableAvailability.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buscarMesasDisponiveis } from "./tableAvailability";

describe("buscarMesasDisponiveis", () => {
  let ambienteId: string;
  let mesaLivreId: string;
  let mesaReservadaId: string;
  const data = new Date(2027, 5, 15);

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({
      data: { nome: "Ambiente Teste Disponibilidade" },
    });
    ambienteId = ambiente.id;

    const mesaLivre = await prisma.mesa.create({
      data: { ambienteId, numero: "T01", capacidadeLugares: 4 },
    });
    mesaLivreId = mesaLivre.id;

    const mesaReservada = await prisma.mesa.create({
      data: { ambienteId, numero: "T02", capacidadeLugares: 4 },
    });
    mesaReservadaId = mesaReservada.id;

    await prisma.reservaMesa.create({
      data: {
        mesaId: mesaReservadaId,
        nomeCliente: "Cliente Teste",
        telefone: "+5541999999999",
        data,
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId: { in: [mesaLivreId, mesaReservadaId] } } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna só a mesa livre, excluindo a já reservada na data", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data, numPessoas: 2 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].numero).toBe("T01");
  });

  it("retorna vazio quando nenhuma mesa comporta o grupo", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data, numPessoas: 20 });
    expect(resultado).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- tableAvailability`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar**

`src/lib/domain/tableAvailability.ts`:
```ts
import { prisma } from "@/lib/db";
import { selecionarMesasParaExibir } from "./tableFit";
import type { MesaDisponivel } from "@/types/reservaMesa";

export async function buscarMesasDisponiveis(params: {
  ambienteId: string;
  data: Date;
  numPessoas: number;
}): Promise<MesaDisponivel[]> {
  const { ambienteId, data, numPessoas } = params;

  const mesasDoAmbiente = await prisma.mesa.findMany({
    where: { ambienteId, ativa: true },
  });

  const reservasConfirmadas = await prisma.reservaMesa.findMany({
    where: {
      data,
      status: "CONFIRMADA",
      mesaId: { in: mesasDoAmbiente.map((mesa) => mesa.id) },
    },
    select: { mesaId: true },
  });

  const mesasReservadasIds = new Set(reservasConfirmadas.map((r) => r.mesaId));
  const mesasLivres = mesasDoAmbiente.filter((mesa) => !mesasReservadasIds.has(mesa.id));

  const classificadas = selecionarMesasParaExibir(
    mesasLivres.map((mesa) => ({ id: mesa.id, capacidadeLugares: mesa.capacidadeLugares })),
    numPessoas
  );

  return classificadas.map((mesaClassificada) => {
    const mesaOriginal = mesasLivres.find((mesa) => mesa.id === mesaClassificada.id)!;
    return {
      ...mesaClassificada,
      numero: mesaOriginal.numero,
      ambienteId: mesaOriginal.ambienteId,
    };
  });
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- tableAvailability`
Expected: PASS (2 testes)

- [ ] **Step 6: Commit**

```bash
git add src/types/reservaMesa.ts src/lib/domain/tableAvailability.ts src/lib/domain/tableAvailability.test.ts
git commit -m "feat: consulta de mesas disponíveis por ambiente, data e capacidade"
```

---

### Task 4: Utilitário de teste — data futura determinística

**Files:**
- Create: `src/test-utils/datas.ts`

**Interfaces:**
- Produces: `proximaTercaFeiraDistante()` — usado pelas Tasks 5, 6 e pelo E2E (Task 9) para nunca depender de uma data calendário fixa.

- [ ] **Step 1: Implementar diretamente (utilitário de teste, sem TDD próprio — é consumido pelos testes das próximas tasks, que validam seu comportamento indiretamente)**

`src/test-utils/datas.ts`:
```ts
export function proximaTercaFeiraDistante(): string {
  const hoje = new Date();
  const dataFutura = new Date(hoje);
  dataFutura.setDate(hoje.getDate() + 14);

  const TERCA_FEIRA = 2;
  while (dataFutura.getDay() !== TERCA_FEIRA) {
    dataFutura.setDate(dataFutura.getDate() + 1);
  }

  const ano = dataFutura.getFullYear();
  const mes = (dataFutura.getMonth() + 1).toString().padStart(2, "0");
  const dia = dataFutura.getDate().toString().padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
```

**Por que isso existe:** testes de API que dependem do horário real (`new Date()` dentro do código de produção) não podem usar uma data de calendário fixa como `"2026-08-11"` — se o plano for executado meses ou anos depois, a data fixa pode já ter passado, e o comportamento de "filtra horários se for hoje" mudaria silenciosamente o resultado do teste. Calculando a data em tempo de execução do teste, sempre 2+ semanas à frente, o teste nunca expira.

- [ ] **Step 2: Commit**

```bash
git add src/test-utils/datas.ts
git commit -m "test: utilitário de data futura determinística para testes"
```

---

### Task 5: API — GET /api/horarios-disponiveis

**Files:**
- Create: `src/app/api/horarios-disponiveis/route.ts`
- Test: `src/app/api/horarios-disponiveis/route.test.ts`

**Interfaces:**
- Consumes: `gerarHorariosDisponiveis` (Task 1), `prisma.feriado` (Task 2), `proximaTercaFeiraDistante` (Task 4).
- Produces: `GET /api/horarios-disponiveis?data=YYYY-MM-DD` → `{ horarios: string[] }`.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/horarios-disponiveis/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("GET /api/horarios-disponiveis", () => {
  it("retorna 400 quando o parâmetro data está ausente", async () => {
    const request = new NextRequest("http://localhost/api/horarios-disponiveis");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna horários de jantar para uma terça-feira futura sem feriado cadastrado", async () => {
    const data = proximaTercaFeiraDistante();
    const request = new NextRequest(`http://localhost/api/horarios-disponiveis?data=${data}`);
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.horarios).toEqual(["18:30", "19:00", "19:30"]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- horarios-disponiveis`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/horarios-disponiveis/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gerarHorariosDisponiveis } from "@/lib/domain/serviceSchedule";

export async function GET(request: NextRequest) {
  const dataParam = request.nextUrl.searchParams.get("data");

  if (!dataParam) {
    return NextResponse.json({ erro: "parâmetro 'data' é obrigatório" }, { status: 400 });
  }

  const data = new Date(`${dataParam}T00:00:00`);

  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const feriado = await prisma.feriado.findUnique({ where: { data } });
  const horarios = gerarHorariosDisponiveis(data, new Date(), Boolean(feriado));

  return NextResponse.json({ horarios });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- horarios-disponiveis`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/horarios-disponiveis/
git commit -m "feat: rota de horários disponíveis considerando feriado e horário atual"
```

---

### Task 6: API — GET /api/mesas-disponiveis

**Files:**
- Create: `src/app/api/mesas-disponiveis/route.ts`
- Test: `src/app/api/mesas-disponiveis/route.test.ts`

**Interfaces:**
- Consumes: `buscarMesasDisponiveis` (Task 3).
- Produces: `GET /api/mesas-disponiveis?ambienteId=&data=YYYY-MM-DD&numPessoas=` → `{ mesas: MesaDisponivel[] }`.

- [ ] **Step 1: Escrever o teste que falha**

`src/app/api/mesas-disponiveis/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("GET /api/mesas-disponiveis", () => {
  let ambienteId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Rota Mesas" } });
    ambienteId = ambiente.id;
    await prisma.mesa.create({ data: { ambienteId, numero: "R01", capacidadeLugares: 4 } });
  });

  afterAll(async () => {
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna 400 quando faltam parâmetros obrigatórios", async () => {
    const request = new NextRequest("http://localhost/api/mesas-disponiveis");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna as mesas disponíveis para o ambiente, data e número de pessoas", async () => {
    const params = new URLSearchParams({ ambienteId, data, numPessoas: "2" });
    const request = new NextRequest(`http://localhost/api/mesas-disponiveis?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mesas).toHaveLength(1);
    expect(body.mesas[0].numero).toBe("R01");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- mesas-disponiveis`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/mesas-disponiveis/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { buscarMesasDisponiveis } from "@/lib/domain/tableAvailability";

export async function GET(request: NextRequest) {
  const ambienteId = request.nextUrl.searchParams.get("ambienteId");
  const dataParam = request.nextUrl.searchParams.get("data");
  const numPessoasParam = request.nextUrl.searchParams.get("numPessoas");

  if (!ambienteId || !dataParam || !numPessoasParam) {
    return NextResponse.json(
      { erro: "parâmetros 'ambienteId', 'data' e 'numPessoas' são obrigatórios" },
      { status: 400 }
    );
  }

  const numPessoas = Number(numPessoasParam);
  if (!Number.isInteger(numPessoas) || numPessoas <= 0) {
    return NextResponse.json(
      { erro: "'numPessoas' deve ser um número inteiro positivo" },
      { status: 400 }
    );
  }

  const data = new Date(`${dataParam}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const mesas = await buscarMesasDisponiveis({ ambienteId, data, numPessoas });
  return NextResponse.json({ mesas });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- mesas-disponiveis`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mesas-disponiveis/
git commit -m "feat: rota de mesas disponíveis por ambiente, data e número de pessoas"
```

---

### Task 7: API — POST /api/reservas-mesa

**Files:**
- Create: `src/app/api/reservas-mesa/route.ts`
- Test: `src/app/api/reservas-mesa/route.test.ts`

**Interfaces:**
- Consumes: `prisma.reservaMesa` (Fundação), `proximaTercaFeiraDistante` (Task 4).
- Produces: `POST /api/reservas-mesa` → `201` com a reserva criada, `409` se a mesa já estiver reservada naquela data, `400` para dados inválidos.

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/reservas-mesa/route.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "./route";
import { proximaTercaFeiraDistante } from "@/test-utils/datas";

describe("POST /api/reservas-mesa", () => {
  let ambienteId: string;
  let mesaId: string;
  const data = proximaTercaFeiraDistante();

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Criação" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({
      data: { ambienteId, numero: "C01", capacidadeLugares: 4 },
    });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("cria a reserva com dados válidos", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId,
        nomeCliente: "Maria Teste",
        telefone: "+5541988887777",
        data,
        horarioChegada: "19:00",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("retorna 409 ao tentar reservar a mesma mesa na mesma data novamente", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({
        mesaId,
        nomeCliente: "Outro Cliente",
        telefone: "+5541977776666",
        data,
        horarioChegada: "19:30",
        numPessoas: 2,
      }),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.erro).toContain("reservada");
  });

  it("retorna 400 com dados incompletos", async () => {
    const request = new NextRequest("http://localhost/api/reservas-mesa", {
      method: "POST",
      body: JSON.stringify({ mesaId }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- reservas-mesa`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/reservas-mesa/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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
  const body = await request.json();

  if (!validarInput(body)) {
    return NextResponse.json({ erro: "dados da reserva inválidos ou incompletos" }, { status: 400 });
  }

  const data = new Date(`${body.data}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
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
```

**Nota importante:** o índice único que dispara esse erro foi criado via SQL manual na migração da Fundação (`reserva_mesa_unica_confirmada_por_noite`), não pela sintaxe `@@unique` do `schema.prisma` — mesmo assim o Prisma Client mapeia corretamente para `P2002`, porque a violação é detectada pelo Postgres (SQLSTATE 23505), não calculada pelo Prisma a partir do schema declarado.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- reservas-mesa`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reservas-mesa/
git commit -m "feat: rota de criação de reserva de mesa com tratamento de condição de corrida"
```

---

### Task 8: Domain — carregar zonas clicáveis do banco

**Files:**
- Create: `src/lib/tableMap/loadZonesFromDb.ts`
- Test: `src/lib/tableMap/loadZonesFromDb.test.ts`

**Interfaces:**
- Consumes: `prisma.mesa` (Fundação), tipo `ZonaClicavel` (Fundação, `src/providers/tableMap/TableMapProvider.ts`).
- Produces: `carregarZonasDoAmbiente(ambienteId)` — lê o campo `posicaoTour` (JSON) de cada `Mesa` ativa do ambiente e monta as zonas para alimentar o `FallbackMapProvider` (Task 9).

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/tableMap/loadZonesFromDb.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { carregarZonasDoAmbiente } from "./loadZonesFromDb";

describe("carregarZonasDoAmbiente", () => {
  let ambienteId: string;

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Zonas" } });
    ambienteId = ambiente.id;

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "Z01",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 10, y: 20, largura: 8, altura: 8 }),
      },
    });

    await prisma.mesa.create({
      data: { ambienteId, numero: "Z02", capacidadeLugares: 4, posicaoTour: null },
    });
  });

  afterAll(async () => {
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna só mesas com posicaoTour cadastrada, com coordenadas parseadas", async () => {
    const zonas = await carregarZonasDoAmbiente(ambienteId);
    expect(zonas).toEqual([
      { mesaId: expect.any(String), numero: "Z01", coordenadas: { x: 10, y: 20, largura: 8, altura: 8 } },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- loadZonesFromDb`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/tableMap/loadZonesFromDb.ts`:
```ts
import { prisma } from "@/lib/db";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";

export async function carregarZonasDoAmbiente(ambienteId: string): Promise<ZonaClicavel[]> {
  const mesas = await prisma.mesa.findMany({
    where: { ambienteId, ativa: true, posicaoTour: { not: null } },
  });

  return mesas.map((mesa) => {
    const coordenadas = JSON.parse(mesa.posicaoTour as string) as ZonaClicavel["coordenadas"];
    return { mesaId: mesa.id, numero: mesa.numero, coordenadas };
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- loadZonesFromDb`
Expected: PASS (1 teste)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tableMap/
git commit -m "feat: carrega zonas clicáveis do mapa a partir das mesas cadastradas"
```

---

### Task 9: UI — página e assistente de reserva

**Files:**
- Modify: `vitest.config.ts` (adiciona plugin React + jsdom só para testes de componente)
- Create: `vitest.setup.ts`
- Create: `src/app/reservar-mesa/page.tsx`
- Create: `src/app/reservar-mesa/ReservaMesaWizard.tsx`
- Test: `src/app/reservar-mesa/ReservaMesaWizard.test.tsx`

**Interfaces:**
- Consumes: `FallbackMapProvider` (Fundação), `carregarZonasDoAmbiente` (Task 8), `MesaDisponivel` (Task 3), rotas `/api/horarios-disponiveis`, `/api/mesas-disponiveis`, `/api/reservas-mesa` (Tasks 5-7).
- Produces: página `/reservar-mesa` navegável pelo cliente.

- [ ] **Step 1: Instalar dependências de teste de componente**

Run: `npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react`

- [ ] **Step 2: Atualizar a configuração do Vitest para suportar JSX e DOM**

`vitest.config.ts` (substitua o conteúdo existente):
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

`vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

**Por que o ambiente global continua `"node"`:** os testes de domínio e de rota (Tasks 1-7) não precisam de DOM e rodam mais rápido em `node`. O teste de componente desta task usa a diretiva `// @vitest-environment jsdom` no topo do próprio arquivo para pedir jsdom só para si, sem afetar os outros testes.

- [ ] **Step 3: Escrever o teste de componente que falha**

`src/app/reservar-mesa/ReservaMesaWizard.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaMesaWizard } from "./ReservaMesaWizard";

describe("ReservaMesaWizard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/horarios-disponiveis")) {
          return new Response(JSON.stringify({ horarios: ["18:30", "19:00"] }), { status: 200 });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );
  });

  it("mostra os horários retornados depois de escolher uma data", async () => {
    render(
      <ReservaMesaWizard
        ambientes={[{ id: "amb_1", nome: "Deck" }]}
        zonasPorAmbiente={{ amb_1: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-11" } });
    fireEvent.click(screen.getByText("Ver horários"));

    await waitFor(() => {
      expect(screen.getByText("18:30")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npm test -- ReservaMesaWizard`
Expected: FAIL — módulo não existe.

- [ ] **Step 5: Implementar o componente**

`src/app/reservar-mesa/ReservaMesaWizard.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";
import type { MesaDisponivel } from "@/types/reservaMesa";

interface Ambiente {
  id: string;
  nome: string;
}

interface ReservaMesaWizardProps {
  ambientes: Ambiente[];
  zonasPorAmbiente: Record<string, ZonaClicavel[]>;
}

type Etapa = "quando" | "onde" | "dados" | "confirmado";

export function ReservaMesaWizard({ ambientes, zonasPorAmbiente }: ReservaMesaWizardProps) {
  const [etapa, setEtapa] = useState<Etapa>("quando");
  const [data, setData] = useState("");
  const [numPessoas, setNumPessoas] = useState(2);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [horarioChegada, setHorarioChegada] = useState("");
  const [ambienteSelecionadoId, setAmbienteSelecionadoId] = useState(ambientes[0]?.id ?? "");
  const [mesasDisponiveis, setMesasDisponiveis] = useState<MesaDisponivel[]>([]);
  const [mesaSelecionadaId, setMesaSelecionadaId] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function buscarHorarios() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/horarios-disponiveis?data=${data}`);
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível buscar horários");
        return;
      }
      if (corpo.horarios.length === 0) {
        setErro("não há horários disponíveis para essa data");
        return;
      }
      setHorarios(corpo.horarios);
    } finally {
      setCarregando(false);
    }
  }

  async function buscarMesas(ambienteId: string) {
    setErro("");
    setCarregando(true);
    try {
      const params = new URLSearchParams({ ambienteId, data, numPessoas: String(numPessoas) });
      const resposta = await fetch(`/api/mesas-disponiveis?${params}`);
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível buscar mesas");
        return;
      }
      setMesasDisponiveis(corpo.mesas);
    } finally {
      setCarregando(false);
    }
  }

  async function avancarParaEscolhaDeMesa() {
    setEtapa("onde");
    await buscarMesas(ambienteSelecionadoId);
  }

  async function trocarAmbiente(ambienteId: string) {
    setAmbienteSelecionadoId(ambienteId);
    setMesaSelecionadaId("");
    await buscarMesas(ambienteId);
  }

  async function confirmarReserva() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/reservas-mesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesaId: mesaSelecionadaId,
          nomeCliente,
          telefone,
          data,
          horarioChegada,
          numPessoas,
        }),
      });
      const corpo = await resposta.json();

      if (resposta.status === 409) {
        setErro(corpo.erro);
        setMesaSelecionadaId("");
        setEtapa("onde");
        await buscarMesas(ambienteSelecionadoId);
        return;
      }

      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível confirmar a reserva");
        return;
      }

      setEtapa("confirmado");
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "confirmado") {
    const mesa = mesasDisponiveis.find((m) => m.id === mesaSelecionadaId);
    return (
      <p role="status">
        Reserva confirmada para {nomeCliente} — mesa {mesa?.numero}, {data} às {horarioChegada}.
      </p>
    );
  }

  return (
    <div>
      {erro && <p role="alert">{erro}</p>}

      {etapa === "quando" && (
        <fieldset>
          <legend>Quando você quer vir?</legend>
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <button type="button" onClick={buscarHorarios} disabled={!data || carregando}>
            Ver horários
          </button>

          {horarios.length > 0 && (
            <>
              <label>
                Horário
                <select value={horarioChegada} onChange={(e) => setHorarioChegada(e.target.value)}>
                  <option value="">Selecione</option>
                  {horarios.map((horario) => (
                    <option key={horario} value={horario}>
                      {horario}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Número de pessoas
                <input
                  type="number"
                  min={1}
                  value={numPessoas}
                  onChange={(e) => setNumPessoas(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={avancarParaEscolhaDeMesa}
                disabled={!horarioChegada || numPessoas < 1}
              >
                Escolher mesa
              </button>
            </>
          )}
        </fieldset>
      )}

      {etapa === "onde" && (
        <fieldset>
          <legend>Onde você quer sentar?</legend>
          <div role="tablist">
            {ambientes.map((ambiente) => (
              <button
                key={ambiente.id}
                type="button"
                role="tab"
                aria-selected={ambiente.id === ambienteSelecionadoId}
                onClick={() => trocarAmbiente(ambiente.id)}
              >
                {ambiente.nome}
              </button>
            ))}
          </div>

          <div
            aria-label={`Mapa do ambiente ${ambientes.find((a) => a.id === ambienteSelecionadoId)?.nome ?? ""}`}
            style={{ position: "relative" }}
          >
            {zonasPorAmbiente[ambienteSelecionadoId]
              ?.filter((zona) => mesasDisponiveis.some((mesa) => mesa.id === zona.mesaId))
              .map((zona) => (
                <button
                  key={zona.mesaId}
                  type="button"
                  style={{
                    position: "absolute",
                    left: `${zona.coordenadas.x}%`,
                    top: `${zona.coordenadas.y}%`,
                    width: `${zona.coordenadas.largura}%`,
                    height: `${zona.coordenadas.altura}%`,
                  }}
                  aria-pressed={zona.mesaId === mesaSelecionadaId}
                  onClick={() => setMesaSelecionadaId(zona.mesaId)}
                >
                  Mesa {zona.numero}
                </button>
              ))}
          </div>

          <p>Lista de mesas disponíveis (alternativa acessível ao mapa):</p>
          <ul>
            {mesasDisponiveis.map((mesa) => (
              <li key={mesa.id}>
                <button
                  type="button"
                  aria-pressed={mesa.id === mesaSelecionadaId}
                  onClick={() => setMesaSelecionadaId(mesa.id)}
                >
                  Mesa {mesa.numero} — {mesa.capacidadeLugares} lugares
                  {mesa.faixa === "alternativa" ? " (maior que o ideal para o grupo)" : ""}
                </button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={() => setEtapa("dados")} disabled={!mesaSelecionadaId}>
            Continuar
          </button>
        </fieldset>
      )}

      {etapa === "dados" && (
        <fieldset>
          <legend>Seus dados</legend>
          <label>
            Nome
            <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
          </label>
          <label>
            Telefone
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <button
            type="button"
            onClick={confirmarReserva}
            disabled={!nomeCliente.trim() || !telefone.trim() || carregando}
          >
            Confirmar reserva
          </button>
        </fieldset>
      )}
    </div>
  );
}
```

`src/app/reservar-mesa/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { FallbackMapProvider } from "@/providers/tableMap/FallbackMapProvider";
import { carregarZonasDoAmbiente } from "@/lib/tableMap/loadZonesFromDb";
import { ReservaMesaWizard } from "./ReservaMesaWizard";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";

export default async function ReservarMesaPage() {
  const ambientes = await prisma.ambiente.findMany({ orderBy: { nome: "asc" } });

  const zonasCarregadas: Record<string, ZonaClicavel[]> = {};
  for (const ambiente of ambientes) {
    zonasCarregadas[ambiente.id] = await carregarZonasDoAmbiente(ambiente.id);
  }

  const mapProvider = new FallbackMapProvider(zonasCarregadas);
  const zonasPorAmbiente: Record<string, ZonaClicavel[]> = {};
  for (const ambiente of ambientes) {
    zonasPorAmbiente[ambiente.id] = await mapProvider.obterZonasClicaveis(ambiente.id);
  }

  return (
    <main>
      <h1>Reservar Mesa</h1>
      <ReservaMesaWizard
        ambientes={ambientes.map((a) => ({ id: a.id, nome: a.nome }))}
        zonasPorAmbiente={zonasPorAmbiente}
      />
    </main>
  );
}
```

**Por que a página instancia `FallbackMapProvider` em vez de usar `zonasCarregadas` direto:** é essa linha que muda quando o acesso ao Matterport for liberado (Fase 2) — troca para `new MattertagProvider(...)` e o resto do arquivo continua igual, exatamente como a Fundação planejou.

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- ReservaMesaWizard`
Expected: PASS (1 teste)

- [ ] **Step 7: Verificação manual no navegador**

Run: `docker compose up -d --build`
Acesse `http://localhost:3000/reservar-mesa` no navegador e percorra o fluxo manualmente com os dados de seed (Ambiente "Deck", mesa "D01") para confirmar visualmente antes do E2E automatizado.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts vitest.setup.ts src/app/reservar-mesa/ package.json package-lock.json
git commit -m "feat: página e assistente de reserva de mesa diária"
```

---

### Task 10: E2E — fluxo completo de reserva de mesa

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/reserva-mesa.spec.ts`
- Modify: `package.json` (script `test:e2e`)

**Interfaces:**
- Consumes: página `/reservar-mesa` (Task 9), `prisma` (Fundação) para preparar e limpar dados de teste.

- [ ] **Step 1: Instalar o Playwright**

Run: `npm install --save-dev @playwright/test`
Run: `npx playwright install --with-deps chromium`

- [ ] **Step 2: Criar a configuração**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

Adicione ao `package.json`:
```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 3: Escrever o teste E2E**

**Nota:** este arquivo usa import relativo (`../src/lib/db`) em vez do alias `@/` — o Playwright Test roda fora do pipeline de build do Next.js e não resolve automaticamente os `paths` do `tsconfig.json` sem configuração extra, então o caminho relativo evita esse problema.

`e2e/reserva-mesa.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { proximaTercaFeiraDistante } from "../src/test-utils/datas";

test.describe("Reserva de mesa diária", () => {
  let ambienteId: string;
  let dataReserva: string;

  test.beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente E2E" } });
    ambienteId = ambiente.id;

    await prisma.mesa.create({
      data: {
        ambienteId,
        numero: "E01",
        capacidadeLugares: 4,
        posicaoTour: JSON.stringify({ x: 10, y: 10, largura: 20, altura: 20 }),
      },
    });

    dataReserva = proximaTercaFeiraDistante();
  });

  test.afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesa: { ambienteId } } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  test("cliente reserva uma mesa do início ao fim", async ({ page }) => {
    await page.goto("/reservar-mesa");

    await page.getByLabel("Data").fill(dataReserva);
    await page.getByText("Ver horários").click();

    await page.getByLabel("Horário").selectOption("19:00");
    await page.getByLabel("Número de pessoas").fill("2");
    await page.getByText("Escolher mesa").click();

    await page.getByRole("tab", { name: "Ambiente E2E" }).click();
    // Tanto o botão do mapa quanto o da lista acessível abrem a mesma seleção — .first() é intencional.
    await page.getByText("Mesa E01", { exact: false }).first().click();
    await page.getByText("Continuar").click();

    await page.getByLabel("Nome").fill("Cliente E2E");
    await page.getByLabel("Telefone").fill("+5541999998888");
    await page.getByText("Confirmar reserva").click();

    await expect(page.getByRole("status")).toContainText("Reserva confirmada");
  });
});
```

- [ ] **Step 4: Rodar o E2E com o stack completo no ar**

Run: `docker compose up -d --build`
Run: `npx prisma migrate dev`
Run: `npm run db:seed`
Run: `npm run test:e2e`
Expected: 1 teste passando.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json
git commit -m "test: E2E do fluxo completo de reserva de mesa diária"
```

---

## Checklist final do plano

- [ ] `npm test` passa 100% (Fundação + todas as Tasks deste plano)
- [ ] `npm run test:e2e` passa com o stack Docker no ar
- [ ] Reservar a mesma mesa/data duas vezes pela UI mostra a mensagem de conflito e devolve o cliente à seleção de mesa com a lista atualizada
- [ ] Numa segunda-feira, `/api/horarios-disponiveis` retorna lista vazia
- [ ] Num sábado, `/api/horarios-disponiveis` retorna 6 horários (almoço + jantar)
- [ ] A lista acessível de mesas (não só o mapa) permite completar a reserva inteira só com teclado/leitor de tela

Com isso pronto, o próximo plano (Reserva de Evento no Mezanino) pode reutilizar a mesma base de adaptadores e o mesmo padrão de Route Handlers.
