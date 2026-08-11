# Melhorias do App — Lote 1 (correções e UX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 5 approved items from `docs/superpowers/specs/2026-08-11-melhorias-app-design.md`: correct cardápio link + remove home prices, a real event-availability calendar, an add-on confirmation modal, and occupied-table visualization on the table map.

**Architecture:** Next.js App Router, Server Components by default with `"use client"` boundaries for interactive wizards. Two new pure domain functions (`src/lib/domain/eventCalendarGrid.ts` widening the existing `src/lib/domain/tableAvailability.ts`/`tableFit.ts` pair) keep date/classification logic unit-testable without a real clock or database. Two new Client Components (`EventAvailabilityCalendar`, `AddonConfirmModal`) follow the existing CSS-Modules-only convention — no new dependencies. One new API route (`GET /api/eventos/disponibilidade-mes`) mirrors the existing `disponibilidade` route's shape.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, CSS Modules, Vitest + React Testing Library, Playwright E2E. Native HTML `<dialog>` for the modal — no modal library.

## Global Constraints

- Cardápio URL, exact value, used in all 3 places (nav, footer, home): `https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital`
- No prices anywhere in the home page's "Destaques do cardápio" cards.
- No new npm dependencies. Native `<dialog>` for the modal.
- All new domain logic (`eventCalendarGrid.ts`) is pure — no `Date.now()`/`new Date()` internal calls; callers pass `hoje: Date` in explicitly, so tests never depend on the real clock (matches the existing `test-utils/datas.ts` convention).
- Tests for API routes and domain functions that touch Prisma use the real test database with `beforeAll`/`afterAll` create/delete, following the pattern already in `tableAvailability.test.ts` and `mesas-disponiveis/route.test.ts`. Component tests use Vitest + React Testing Library with `// @vitest-environment jsdom`.
- Occupied tables (`faixa: "ocupada"`) must never become `mesaSelecionadaId` — the button is `disabled`, not just styled.
- The Deck dual-table invariant must hold: a `Mesa` row inactive for the queried weekday (per `diasSemanaAtivos`) never appears in the response at all — not available, not occupied.
- jsdom 30.0.1 (this project's version) does not implement `HTMLDialogElement.showModal()`/`.close()` — the modal component must degrade gracefully (see Task 4).

---

## File Structure

New files:
- `src/lib/constants.ts` — shared `CARDAPIO_URL`.
- `src/app/api/eventos/disponibilidade-mes/route.ts` + `.test.ts` — month-range occupied-dates API.
- `src/lib/domain/eventCalendarGrid.ts` + `.test.ts` — pure month-grid builder, no DB/clock access.
- `src/components/EventAvailabilityCalendar.tsx` + `.module.css` + `.test.tsx` — the calendar widget.
- `src/components/AddonConfirmModal.tsx` + `.module.css` + `.test.tsx` — the add-on confirmation dialog.

Modified files:
- `src/components/SiteNav.tsx`, `src/components/Footer.tsx`, `src/app/page.tsx` — import `CARDAPIO_URL` from `src/lib/constants.ts` instead of local duplicates.
- `src/components/DishCard.tsx`, `.module.css`, `.test.tsx` — drop the `preco` prop entirely.
- `src/app/reservar-evento/ReservaEventoWizard.tsx`, `.test.tsx` — swap the date `<input>` for `EventAvailabilityCalendar`; wrap the Telão & Projetor checkbox with `AddonConfirmModal`.
- `src/lib/domain/tableFit.ts` — widen `MesaClassificada.faixa` union.
- `src/lib/domain/tableAvailability.ts`, `.test.ts` — include occupied tables tagged `"ocupada"` instead of excluding them.
- `src/app/api/mesas-disponiveis/route.test.ts` — cover the widened response shape.
- `src/app/reservar-mesa/ReservaMesaWizard.tsx`, `.module.css`, `.test.tsx` — render occupied tables disabled/greyed on map + list.
- `e2e/reserva-evento.spec.ts` — replace the date `<input>` fill with calendar clicks.

---

### Task 1: Cardápio link fix + remove home prices

**Files:**
- Create: `src/lib/constants.ts`
- Modify: `src/components/SiteNav.tsx`, `src/components/Footer.tsx`, `src/app/page.tsx`, `src/components/DishCard.tsx`, `src/components/DishCard.module.css`
- Test: `src/components/DishCard.test.tsx` (modify)

**Interfaces:**
- Produces: `export const CARDAPIO_URL: string` from `@/lib/constants`, consumed by `SiteNav`, `Footer`, and `page.tsx`.
- Produces: `DishCard` props shrink to `{ nome: string; descricao: string; imagemSrc: string; imagemAlt: string }` (no `preco`).

- [ ] **Step 1: Write the failing test for `DishCard` without a price**

Replace `src/components/DishCard.test.tsx` entirely with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DishCard } from "./DishCard";

describe("DishCard", () => {
  it("renderiza nome, descrição e imagem com alt, sem preço", () => {
    render(
      <DishCard
        nome="Arancini"
        descricao="Bolinho de risoto com molho de tomate pelado recheado com queijo."
        imagemSrc="/images/prato-arancini.jpg"
        imagemAlt="Arancini servido em prato de madeira"
      />
    );

    expect(screen.getByText("Arancini")).toBeInTheDocument();
    expect(screen.getByText(/Bolinho de risoto/)).toBeInTheDocument();
    expect(screen.getByAltText("Arancini servido em prato de madeira")).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DishCard.test.tsx`
Expected: FAIL — `preco` is a required prop (TS) and the old assertion path no longer matches; the component still renders a price.

- [ ] **Step 3: Create the shared constant**

Create `src/lib/constants.ts`:

```ts
export const CARDAPIO_URL = "https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital";
```

- [ ] **Step 4: Update `SiteNav.tsx` to import the constant**

In `src/components/SiteNav.tsx`, replace:

```tsx
import Link from "next/link";
import styles from "./SiteNav.module.css";

const CARDAPIO_URL = "https://cardapio.pedyun.com.br/antoninaosteria";
```

with:

```tsx
import Link from "next/link";
import { CARDAPIO_URL } from "@/lib/constants";
import styles from "./SiteNav.module.css";
```

- [ ] **Step 5: Update `Footer.tsx` to import the constant**

In `src/components/Footer.tsx`, replace:

```tsx
import Link from "next/link";
import styles from "./Footer.module.css";

const CARDAPIO_URL = "https://cardapio.pedyun.com.br/antoninaosteria";
```

with:

```tsx
import Link from "next/link";
import { CARDAPIO_URL } from "@/lib/constants";
import styles from "./Footer.module.css";
```

- [ ] **Step 6: Update `page.tsx` — import the constant and drop `preco` from every dish**

In `src/app/page.tsx`, replace:

```tsx
import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import styles from "./page.module.css";

const CARDAPIO_URL = "https://cardapio.pedyun.com.br/antoninaosteria";

const PRATOS_DESTAQUE = [
  {
    nome: "Arancini",
    descricao: "Bolinho de risoto com molho de tomate pelado recheado com queijo.",
    preco: 42,
    imagemSrc: "/images/prato-arancini.jpg",
    imagemAlt: "Arancini servido em prato de madeira",
  },
  {
    nome: "Burrata al Pesto",
    descricao: "Burrata com pesto, raspas de limão siciliano, parma e rúculas. Acompanha torradas.",
    preco: 98,
    imagemSrc: "/images/prato-burrata.jpg",
    imagemAlt: "Burrata al Pesto com folhas de rúcula",
  },
  {
    nome: "Cacio e Pepe",
    descricao: "Spaghetti tradicional Cacio e Pepe.",
    preco: 78,
    imagemSrc: "/images/prato-cacio-e-pepe.jpg",
    imagemAlt: "Prato de spaghetti Cacio e Pepe",
  },
  {
    nome: "Banoffee Antonina",
    descricao: "Banoffee feita com doce de leite da casa, farofa crocante com toque de mascarpone.",
    preco: 42,
    imagemSrc: "/images/prato-banoffee.jpg",
    imagemAlt: "Sobremesa Banoffee Antonina",
  },
];
```

with:

```tsx
import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import { CARDAPIO_URL } from "@/lib/constants";
import styles from "./page.module.css";

const PRATOS_DESTAQUE = [
  {
    nome: "Arancini",
    descricao: "Bolinho de risoto com molho de tomate pelado recheado com queijo.",
    imagemSrc: "/images/prato-arancini.jpg",
    imagemAlt: "Arancini servido em prato de madeira",
  },
  {
    nome: "Burrata al Pesto",
    descricao: "Burrata com pesto, raspas de limão siciliano, parma e rúculas. Acompanha torradas.",
    imagemSrc: "/images/prato-burrata.jpg",
    imagemAlt: "Burrata al Pesto com folhas de rúcula",
  },
  {
    nome: "Cacio e Pepe",
    descricao: "Spaghetti tradicional Cacio e Pepe.",
    imagemSrc: "/images/prato-cacio-e-pepe.jpg",
    imagemAlt: "Prato de spaghetti Cacio e Pepe",
  },
  {
    nome: "Banoffee Antonina",
    descricao: "Banoffee feita com doce de leite da casa, farofa crocante com toque de mascarpone.",
    imagemSrc: "/images/prato-banoffee.jpg",
    imagemAlt: "Sobremesa Banoffee Antonina",
  },
];
```

The rest of `page.tsx` (JSX) is unchanged — `<DishCard key={prato.nome} {...prato} />` already spreads whatever fields exist.

- [ ] **Step 7: Update `DishCard.tsx` — drop the `preco` prop**

Replace `src/components/DishCard.tsx` entirely with:

```tsx
import Image from "next/image";
import styles from "./DishCard.module.css";

interface DishCardProps {
  nome: string;
  descricao: string;
  imagemSrc: string;
  imagemAlt: string;
}

export function DishCard({ nome, descricao, imagemSrc, imagemAlt }: DishCardProps) {
  return (
    <article className={styles.card}>
      <Image
        src={imagemSrc}
        alt={imagemAlt}
        width={320}
        height={320}
        className={styles.imagem}
      />
      <h3 className={styles.nome}>{nome}</h3>
      <p className={styles.descricao}>{descricao}</p>
    </article>
  );
}
```

- [ ] **Step 8: Remove the `.preco` rule from `DishCard.module.css`**

In `src/components/DishCard.module.css`, delete this block (the last rule in the file):

```css
.preco {
  font-family: var(--font-display);
  color: var(--wine);
  font-size: 0.95rem;
  padding: var(--space-xs) var(--space-sm) var(--space-sm);
  margin: 0;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/components/DishCard.test.tsx`
Expected: PASS

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: no errors (confirms no other file still passes `preco` to `DishCard`).

- [ ] **Step 11: Commit**

```bash
git add src/lib/constants.ts src/components/SiteNav.tsx src/components/Footer.tsx src/app/page.tsx src/components/DishCard.tsx src/components/DishCard.module.css src/components/DishCard.test.tsx
git commit -m "fix: corrige link do cardápio e remove preços da home"
```

---

### Task 2: `GET /api/eventos/disponibilidade-mes` route

**Files:**
- Create: `src/app/api/eventos/disponibilidade-mes/route.ts`
- Test: `src/app/api/eventos/disponibilidade-mes/route.test.ts`

**Interfaces:**
- Consumes: `liberarHoldsExpirados(): Promise<void>` from `@/lib/domain/eventHolds` (existing).
- Produces: `GET(request: NextRequest): Promise<NextResponse>` returning `{ datasOcupadas: string[] }` (dates as `YYYY-MM-DD`) on success, `{ erro: string }` with status 400 on bad params. Consumed by `EventAvailabilityCalendar` in Task 3.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/eventos/disponibilidade-mes/route.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/eventos/disponibilidade-mes", () => {
  let reservaId: string;
  const anoTeste = 2027;
  const mesTeste = 9;

  beforeAll(async () => {
    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Teste Mês",
        clienteTelefone: "+5541999999999",
        clienteEmail: "teste-mes@exemplo.com",
        tipoEvento: "ANIVERSARIO",
        data: new Date(anoTeste, mesTeste - 1, 15),
        numConvidados: 10,
        valorTotal: 1000,
        status: "CONFIRMADA",
      },
    });
    reservaId = reserva.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.delete({ where: { id: reservaId } });
  });

  it("retorna 400 quando faltam parâmetros obrigatórios", async () => {
    const request = new NextRequest("http://localhost/api/eventos/disponibilidade-mes");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna as datas ocupadas do mês pedido", async () => {
    const params = new URLSearchParams({ ano: String(anoTeste), mes: String(mesTeste) });
    const request = new NextRequest(`http://localhost/api/eventos/disponibilidade-mes?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.datasOcupadas).toEqual([`${anoTeste}-09-15`]);
  });

  it("não retorna datas de outros meses", async () => {
    const params = new URLSearchParams({ ano: String(anoTeste), mes: "10" });
    const request = new NextRequest(`http://localhost/api/eventos/disponibilidade-mes?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.datasOcupadas).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/eventos/disponibilidade-mes/route.test.ts`
Expected: FAIL — `./route` does not exist yet.

- [ ] **Step 3: Write the route**

Create `src/app/api/eventos/disponibilidade-mes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { liberarHoldsExpirados } from "@/lib/domain/eventHolds";

export async function GET(request: NextRequest) {
  const anoParam = request.nextUrl.searchParams.get("ano");
  const mesParam = request.nextUrl.searchParams.get("mes");

  if (!anoParam || !mesParam) {
    return NextResponse.json(
      { erro: "parâmetros 'ano' e 'mes' são obrigatórios" },
      { status: 400 }
    );
  }

  const ano = Number(anoParam);
  const mes = Number(mesParam);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json(
      { erro: "'ano' e 'mes' devem ser números inteiros válidos (mes entre 1 e 12)" },
      { status: 400 }
    );
  }

  await liberarHoldsExpirados();

  const inicioMes = new Date(ano, mes - 1, 1);
  const inicioProximoMes = new Date(ano, mes, 1);

  const reservasNoMes = await prisma.reservaEvento.findMany({
    where: {
      data: { gte: inicioMes, lt: inicioProximoMes },
      status: { in: ["AGUARDANDO_PAGAMENTO", "CONFIRMADA"] },
    },
    select: { data: true },
  });

  const datasOcupadas = reservasNoMes.map((reserva) => {
    const d = reserva.data;
    const anoStr = d.getFullYear();
    const mesStr = String(d.getMonth() + 1).padStart(2, "0");
    const diaStr = String(d.getDate()).padStart(2, "0");
    return `${anoStr}-${mesStr}-${diaStr}`;
  });

  return NextResponse.json({ datasOcupadas });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/eventos/disponibilidade-mes/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/eventos/disponibilidade-mes/
git commit -m "feat: adiciona rota de disponibilidade de evento por mês"
```

---

### Task 3: `EventAvailabilityCalendar` component + integration

**Files:**
- Create: `src/lib/domain/eventCalendarGrid.ts`
- Test: `src/lib/domain/eventCalendarGrid.test.ts`
- Create: `src/components/EventAvailabilityCalendar.tsx`
- Create: `src/components/EventAvailabilityCalendar.module.css`
- Test: `src/components/EventAvailabilityCalendar.test.tsx`
- Modify: `src/app/reservar-evento/ReservaEventoWizard.tsx`
- Modify: `src/app/reservar-evento/ReservaEventoWizard.test.tsx`
- Modify: `e2e/reserva-evento.spec.ts`

**Interfaces:**
- Consumes: `GET /api/eventos/disponibilidade-mes?ano=&mes=` from Task 2, returning `{ datasOcupadas: string[] }`.
- Produces: `export const NOMES_MESES: string[]` (12 lowercase Portuguese month names, index 0 = janeiro) from `@/lib/domain/eventCalendarGrid` — reused by the component, its tests, and `e2e/reserva-evento.spec.ts`.
- Produces: `export type EstadoDia = "passado" | "ocupado" | "disponivel" | "selecionado"` and `export interface DiaGrade { data: string; diaDoMes: number; estado: EstadoDia }` from the same file.
- Produces: `export function construirGradeDoMes(params: { ano: number; mes: number; hoje: Date; datasOcupadas: string[]; dataSelecionada: string }): (DiaGrade | null)[]` — `null` entries are leading padding cells before day 1, aligning the grid to the correct weekday column.
- Produces: `export function EventAvailabilityCalendar({ value, onChange }: { value: string; onChange: (data: string) => void }): JSX.Element` from `@/components/EventAvailabilityCalendar`. Each day is a `<button>` with `aria-label` = `` `${dia} de ${nomeMes}, ${descricao}` `` where `descricao` is `"disponível"` / `"indisponível"` / `"selecionado"`. Month navigation buttons have `aria-label="Mês anterior"` / `aria-label="Próximo mês"`.

- [ ] **Step 1: Write the failing test for the pure grid function**

Create `src/lib/domain/eventCalendarGrid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { construirGradeDoMes, NOMES_MESES } from "./eventCalendarGrid";

describe("construirGradeDoMes", () => {
  it("preenche células vazias no início do mês até o primeiro dia da semana correto", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const offsetEsperado = new Date(2027, 8, 1).getDay();
    const celulasVaziasIniciais = grade.slice(0, offsetEsperado);
    expect(celulasVaziasIniciais.every((celula) => celula === null)).toBe(true);
    expect(grade[offsetEsperado]).not.toBeNull();
    expect(grade[offsetEsperado]?.diaDoMes).toBe(1);
  });

  it("inclui todos os dias do mês, com o total de dias preenchidos batendo com o mês", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const diasNoMes = new Date(2027, 9, 0).getDate();
    const diasPreenchidos = grade.filter((celula) => celula !== null);
    expect(diasPreenchidos).toHaveLength(diasNoMes);
  });

  it("marca dias antes de hoje como 'passado'", () => {
    const hoje = new Date(2027, 8, 15);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const dia10 = grade.find((celula) => celula?.diaDoMes === 10);
    expect(dia10?.estado).toBe("passado");
  });

  it("marca o próprio dia de hoje como 'disponivel', não 'passado'", () => {
    const hoje = new Date(2027, 8, 15);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "",
    });

    const dia15 = grade.find((celula) => celula?.diaDoMes === 15);
    expect(dia15?.estado).toBe("disponivel");
  });

  it("marca datas presentes em datasOcupadas como 'ocupado'", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: ["2027-09-20"],
      dataSelecionada: "",
    });

    const dia20 = grade.find((celula) => celula?.diaDoMes === 20);
    expect(dia20?.estado).toBe("ocupado");
  });

  it("marca a data selecionada como 'selecionado'", () => {
    const hoje = new Date(2027, 8, 1);
    const grade = construirGradeDoMes({
      ano: 2027,
      mes: 9,
      hoje,
      datasOcupadas: [],
      dataSelecionada: "2027-09-22",
    });

    const dia22 = grade.find((celula) => celula?.diaDoMes === 22);
    expect(dia22?.estado).toBe("selecionado");
  });
});

describe("NOMES_MESES", () => {
  it("tem 12 nomes de mês em português, começando por janeiro", () => {
    expect(NOMES_MESES).toHaveLength(12);
    expect(NOMES_MESES[0]).toBe("janeiro");
    expect(NOMES_MESES[8]).toBe("setembro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/eventCalendarGrid.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the pure grid function**

Create `src/lib/domain/eventCalendarGrid.ts`:

```ts
export const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type EstadoDia = "passado" | "ocupado" | "disponivel" | "selecionado";

export interface DiaGrade {
  data: string;
  diaDoMes: number;
  estado: EstadoDia;
}

export function construirGradeDoMes(params: {
  ano: number;
  mes: number;
  hoje: Date;
  datasOcupadas: string[];
  dataSelecionada: string;
}): (DiaGrade | null)[] {
  const { ano, mes, hoje, datasOcupadas, dataSelecionada } = params;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const celulas: (DiaGrade | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas.push(null);
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataDate = new Date(ano, mes - 1, dia);
    const dataIso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

    let estado: EstadoDia;
    if (dataDate.getTime() < hojeSemHora.getTime()) {
      estado = "passado";
    } else if (dataIso === dataSelecionada) {
      estado = "selecionado";
    } else if (datasOcupadas.includes(dataIso)) {
      estado = "ocupado";
    } else {
      estado = "disponivel";
    }

    celulas.push({ data: dataIso, diaDoMes: dia, estado });
  }

  return celulas;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/eventCalendarGrid.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Write the failing test for the component**

Create `src/components/EventAvailabilityCalendar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventAvailabilityCalendar } from "./EventAvailabilityCalendar";
import { NOMES_MESES } from "@/lib/domain/eventCalendarGrid";
import { daquiADias } from "@/test-utils/datas";

describe("EventAvailabilityCalendar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ datasOcupadas: [] }), { status: 200 }))
    );
  });

  it("mostra o mês atual ao carregar, com o dia de hoje disponível", async () => {
    render(<EventAvailabilityCalendar value="" onChange={vi.fn()} />);

    const hoje = new Date();
    const nomeMes = NOMES_MESES[hoje.getMonth()];
    expect(screen.getByText(`${nomeMes} de ${hoje.getFullYear()}`)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: `${hoje.getDate()} de ${nomeMes}, disponível` })
      ).toBeInTheDocument();
    });
  });

  it("desabilita o botão de mês anterior quando o mês exibido é o mês atual", () => {
    render(<EventAvailabilityCalendar value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Mês anterior")).toBeDisabled();
  });

  it("marca como ocupado um dia retornado pela API e não permite selecioná-lo", async () => {
    const alvo = daquiADias(5);
    const dataIso = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(alvo.getDate()).padStart(2, "0")}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ datasOcupadas: [dataIso] }), { status: 200 }))
    );

    const onChange = vi.fn();
    render(<EventAvailabilityCalendar value="" onChange={onChange} />);

    const hoje = new Date();
    const mesmoMes = alvo.getFullYear() === hoje.getFullYear() && alvo.getMonth() === hoje.getMonth();
    if (!mesmoMes) {
      fireEvent.click(screen.getByLabelText("Próximo mês"));
    }

    const nomeMes = NOMES_MESES[alvo.getMonth()];
    const botao = await screen.findByRole("button", {
      name: `${alvo.getDate()} de ${nomeMes}, indisponível`,
    });
    expect(botao).toBeDisabled();

    fireEvent.click(botao);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chama onChange com a data no formato YYYY-MM-DD ao clicar num dia disponível", async () => {
    const onChange = vi.fn();
    render(<EventAvailabilityCalendar value="" onChange={onChange} />);

    const hoje = new Date();
    const nomeMes = NOMES_MESES[hoje.getMonth()];
    const botao = await screen.findByRole("button", {
      name: `${hoje.getDate()} de ${nomeMes}, disponível`,
    });
    fireEvent.click(botao);

    const anoEsperado = hoje.getFullYear();
    const mesEsperado = String(hoje.getMonth() + 1).padStart(2, "0");
    const diaEsperado = String(hoje.getDate()).padStart(2, "0");
    expect(onChange).toHaveBeenCalledWith(`${anoEsperado}-${mesEsperado}-${diaEsperado}`);
  });

  it("avança de mês ao clicar em 'Próximo mês' e busca as datas ocupadas do novo mês", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ datasOcupadas: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EventAvailabilityCalendar value="" onChange={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("Próximo mês"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const hoje = new Date();
    const proximoMes = hoje.getMonth() === 11 ? 0 : hoje.getMonth() + 1;
    const anoExibido = hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    expect(screen.getByText(`${NOMES_MESES[proximoMes]} de ${anoExibido}`)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/EventAvailabilityCalendar.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write the component's CSS module**

Create `src/components/EventAvailabilityCalendar.module.css`:

```css
.calendario {
  border: 1px solid var(--paper-border);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  background: #fff;
}

.cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.tituloMes {
  font-family: var(--font-display);
  font-size: 1rem;
  text-transform: capitalize;
}

.botaoNavegacao {
  background: none;
  border: 1px solid var(--paper-border);
  width: 2rem;
  height: 2rem;
  font-size: 1.1rem;
  cursor: pointer;
}

.botaoNavegacao:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.gradeDiasSemana,
.gradeDias {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.diaSemana {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-on-paper);
  opacity: 0.7;
  padding: var(--space-xs) 0;
}

.diaVazio {
  aspect-ratio: 1;
}

.diaBotao {
  aspect-ratio: 1;
  border: 1px solid var(--paper-border);
  background: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.dia_passado,
.dia_ocupado {
  background: rgba(92, 58, 63, 0.08);
  color: var(--text-on-paper);
  opacity: 0.4;
  cursor: not-allowed;
  text-decoration: line-through;
}

.dia_disponivel:hover {
  background: rgba(92, 58, 63, 0.08);
}

.dia_selecionado {
  background: var(--wine);
  color: var(--paper);
  border-color: var(--wine);
}
```

- [ ] **Step 8: Write the component**

Create `src/components/EventAvailabilityCalendar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { construirGradeDoMes, NOMES_MESES, type EstadoDia } from "@/lib/domain/eventCalendarGrid";
import styles from "./EventAvailabilityCalendar.module.css";

interface EventAvailabilityCalendarProps {
  value: string;
  onChange: (data: string) => void;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseAnoMes(valor: string, hoje: Date): { ano: number; mes: number } {
  if (!valor) {
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  }
  const [anoStr, mesStr] = valor.split("-");
  return { ano: Number(anoStr), mes: Number(mesStr) };
}

function descricaoEstado(estado: EstadoDia): string {
  switch (estado) {
    case "disponivel":
      return "disponível";
    case "selecionado":
      return "selecionado";
    default:
      return "indisponível";
  }
}

export function EventAvailabilityCalendar({ value, onChange }: EventAvailabilityCalendarProps) {
  const hoje = new Date();
  const [mesExibido, setMesExibido] = useState(() => parseAnoMes(value, hoje));
  const [datasOcupadas, setDatasOcupadas] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function buscarDatasOcupadas() {
      try {
        const params = new URLSearchParams({
          ano: String(mesExibido.ano),
          mes: String(mesExibido.mes),
        });
        const resposta = await fetch(`/api/eventos/disponibilidade-mes?${params}`);
        if (!resposta.ok || cancelado) return;
        const corpo = await resposta.json();
        if (!cancelado) setDatasOcupadas(corpo.datasOcupadas ?? []);
      } catch {
        // Se a busca falhar, o calendário fica sem marcação de ocupação;
        // "Verificar disponibilidade" ainda protege a reserva no servidor.
      }
    }
    buscarDatasOcupadas();
    return () => {
      cancelado = true;
    };
  }, [mesExibido.ano, mesExibido.mes]);

  const mesAtualReal = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const noMesAtual = mesExibido.ano === mesAtualReal.ano && mesExibido.mes === mesAtualReal.mes;

  function irParaMesAnterior() {
    setMesExibido((atual) => {
      const mes = atual.mes === 1 ? 12 : atual.mes - 1;
      const ano = atual.mes === 1 ? atual.ano - 1 : atual.ano;
      return { ano, mes };
    });
  }

  function irParaProximoMes() {
    setMesExibido((atual) => {
      const mes = atual.mes === 12 ? 1 : atual.mes + 1;
      const ano = atual.mes === 12 ? atual.ano + 1 : atual.ano;
      return { ano, mes };
    });
  }

  const celulas = construirGradeDoMes({
    ano: mesExibido.ano,
    mes: mesExibido.mes,
    hoje,
    datasOcupadas,
    dataSelecionada: value,
  });

  return (
    <div className={styles.calendario}>
      <div className={styles.cabecalho}>
        <button
          type="button"
          onClick={irParaMesAnterior}
          disabled={noMesAtual}
          aria-label="Mês anterior"
          className={styles.botaoNavegacao}
        >
          ‹
        </button>
        <span className={styles.tituloMes}>
          {NOMES_MESES[mesExibido.mes - 1]} de {mesExibido.ano}
        </span>
        <button
          type="button"
          onClick={irParaProximoMes}
          aria-label="Próximo mês"
          className={styles.botaoNavegacao}
        >
          ›
        </button>
      </div>

      <div className={styles.gradeDiasSemana}>
        {DIAS_SEMANA.map((dia) => (
          <span key={dia} className={styles.diaSemana}>
            {dia}
          </span>
        ))}
      </div>

      <div className={styles.gradeDias}>
        {celulas.map((celula, indice) =>
          celula === null ? (
            <span key={`vazio-${indice}`} className={styles.diaVazio} />
          ) : (
            <button
              key={celula.data}
              type="button"
              className={`${styles.diaBotao} ${styles[`dia_${celula.estado}`]}`}
              disabled={celula.estado === "passado" || celula.estado === "ocupado"}
              aria-label={`${celula.diaDoMes} de ${NOMES_MESES[mesExibido.mes - 1]}, ${descricaoEstado(celula.estado)}`}
              onClick={() => onChange(celula.data)}
            >
              {celula.diaDoMes}
            </button>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/components/EventAvailabilityCalendar.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 10: Integrate into `ReservaEventoWizard.tsx`**

In `src/app/reservar-evento/ReservaEventoWizard.tsx`, add the import (after the `WizardProgress` import):

```tsx
import { WizardProgress, type WizardStep } from "@/components/WizardProgress";
import { EventAvailabilityCalendar } from "@/components/EventAvailabilityCalendar";
import styles from "./ReservaEventoWizard.module.css";
```

Then replace the "quando" step's date field:

```tsx
          <label className={styles.campo}>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
```

with:

```tsx
          <div className={styles.campo}>
            <span>Data</span>
            <EventAvailabilityCalendar value={data} onChange={setData} />
          </div>
```

No other logic in the wizard changes — `verificarDisponibilidade()` still re-checks the single date server-side on "Verificar disponibilidade" as the authoritative check.

- [ ] **Step 11: Update `ReservaEventoWizard.test.tsx` for the new date picker**

Replace `src/app/reservar-evento/ReservaEventoWizard.test.tsx` entirely with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaEventoWizard } from "./ReservaEventoWizard";
import { NOMES_MESES } from "@/lib/domain/eventCalendarGrid";
import { daquiADias } from "@/test-utils/datas";

function selecionarDataNoCalendario(dataAlvo: Date) {
  const hoje = new Date();
  const mesmoMes =
    dataAlvo.getFullYear() === hoje.getFullYear() && dataAlvo.getMonth() === hoje.getMonth();
  if (!mesmoMes) {
    fireEvent.click(screen.getByLabelText("Próximo mês"));
  }
  const nomeMes = NOMES_MESES[dataAlvo.getMonth()];
  fireEvent.click(
    screen.getByRole("button", { name: `${dataAlvo.getDate()} de ${nomeMes}, disponível` })
  );
}

describe("ReservaEventoWizard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/eventos/disponibilidade")) {
          return new Response(JSON.stringify({ disponivel: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );
  });

  it("avança para a etapa de pacote quando a data está disponível", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 197 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null },
        ]}
      />
    );

    selecionarDataNoCalendario(daquiADias(10));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });
  });

  it("marca visualmente o rádio selecionado, incluindo o pacote Cardápio Aberto", async () => {
    render(
      <ReservaEventoWizard
        pacotes={[
          { id: "pac_1", nome: "Clássico", precoPessoa: 197 },
          { id: "pac_2", nome: "Cardápio Aberto", precoPessoa: null },
        ]}
      />
    );

    selecionarDataNoCalendario(daquiADias(10));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });

    const radioClassico = screen.getByRole("radio", { name: /Clássico/ });
    const radioCardapioAberto = screen.getByRole("radio", { name: /Cardápio Aberto/ });

    fireEvent.click(radioCardapioAberto);
    expect(radioCardapioAberto).toBeChecked();
    expect(radioClassico).not.toBeChecked();

    fireEvent.click(radioClassico);
    expect(radioClassico).toBeChecked();
    expect(radioCardapioAberto).not.toBeChecked();
  });

  it("não exige ciência do Art. 49 do CDC quando o evento está a exatos 7 dias de distância", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (url.toString().includes("/api/eventos/disponibilidade")) {
          return new Response(JSON.stringify({ disponivel: true }), { status: 200 });
        }
        if (url.toString().endsWith("/api/eventos/reservas") && options?.method === "POST") {
          return new Response(JSON.stringify({ reserva: { id: "res_1", valorTotal: "2200" } }), {
            status: 201,
          });
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );

    render(<ReservaEventoWizard pacotes={[{ id: "pac_1", nome: "Clássico", precoPessoa: 197 }]} />);

    selecionarDataNoCalendario(daquiADias(7));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "+5541999999999" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@exemplo.com" } });
    fireEvent.click(screen.getByText("Verificar disponibilidade"));

    await waitFor(() => {
      expect(screen.getByText("Escolha o pacote")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /Clássico/ }));
    fireEvent.click(screen.getByText("Continuar para pagamento"));

    await waitFor(() => {
      expect(screen.getByText("Pagamento")).toBeInTheDocument();
    });

    expect(screen.queryByText(/direito de arrependimento/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).not.toBeDisabled();
  });
});

describe("ReservaEventoWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaEventoWizard pacotes={[]} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
```

- [ ] **Step 12: Run the wizard test to verify it passes**

Run: `npx vitest run src/app/reservar-evento/ReservaEventoWizard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 13: Update the E2E spec's date selection**

In `e2e/reserva-evento.spec.ts`, replace:

```ts
import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { proximaTercaFeiraDistante } from "../src/test-utils/datas";
```

with:

```ts
import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { proximaTercaFeiraDistante } from "../src/test-utils/datas";
import { NOMES_MESES } from "../src/lib/domain/eventCalendarGrid";
```

Then replace:

```ts
    await page.goto("/reservar-evento");

    await page.getByLabel("Data").fill(dataEvento);
    await page.getByLabel("Nome").fill("Empresa E2E");
```

with:

```ts
    await page.goto("/reservar-evento");

    const dataEventoObj = new Date(`${dataEvento}T00:00:00`);
    const hoje = new Date();
    const mesmoMes =
      dataEventoObj.getFullYear() === hoje.getFullYear() &&
      dataEventoObj.getMonth() === hoje.getMonth();
    if (!mesmoMes) {
      await page.getByLabel("Próximo mês").click();
    }
    const nomeMes = NOMES_MESES[dataEventoObj.getMonth()];
    await page
      .getByRole("button", { name: `${dataEventoObj.getDate()} de ${nomeMes}, disponível` })
      .click();

    await page.getByLabel("Nome").fill("Empresa E2E");
```

- [ ] **Step 14: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add src/lib/domain/eventCalendarGrid.ts src/lib/domain/eventCalendarGrid.test.ts src/components/EventAvailabilityCalendar.tsx src/components/EventAvailabilityCalendar.module.css src/components/EventAvailabilityCalendar.test.tsx src/app/reservar-evento/ReservaEventoWizard.tsx src/app/reservar-evento/ReservaEventoWizard.test.tsx e2e/reserva-evento.spec.ts
git commit -m "feat: calendário de disponibilidade de evento com datas ocupadas visíveis"
```

---

### Task 4: `AddonConfirmModal` component + integration

**Files:**
- Create: `src/components/AddonConfirmModal.tsx`
- Create: `src/components/AddonConfirmModal.module.css`
- Test: `src/components/AddonConfirmModal.test.tsx`
- Modify: `src/app/reservar-evento/ReservaEventoWizard.tsx`

**Interfaces:**
- Consumes: nothing external.
- Produces: `export function AddonConfirmModal(props: { open: boolean; pacoteNome: string; valorBase: number; valorAddon: number; onConfirm: () => void; onCancel: () => void }): JSX.Element` from `@/components/AddonConfirmModal`.

**Note on jsdom:** confirmed by direct testing (`node -e` against this project's `jsdom@30.0.1`) that `HTMLDialogElement.prototype.showModal`/`.close` are **not implemented** — calling them throws `TypeError: ... is not a function`. jsdom **does** support the plain `open` boolean property/attribute (setting `dialog.open = true` works and is what `getByRole("dialog")` keys off — a `<dialog>` without the `open` attribute is treated as inaccessible by `@testing-library/dom`, confirmed the same way). The component below tries the native calls first (for real browsers) and falls back to toggling `.open` directly when they throw (for jsdom/tests).

- [ ] **Step 1: Write the failing test**

Create `src/components/AddonConfirmModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddonConfirmModal } from "./AddonConfirmModal";

describe("AddonConfirmModal", () => {
  it("não aparece como dialog acessível quando open é false", () => {
    render(
      <AddonConfirmModal
        open={false}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra pacote, add-on e total quando open é true", () => {
    render(
      <AddonConfirmModal
        open={true}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Clássico — R$ 2200.00")).toBeInTheDocument();
    expect(screen.getByText("Telão & Projetor — R$ 500.00")).toBeInTheDocument();
    expect(screen.getByText("Total: R$ 2700.00")).toBeInTheDocument();
  });

  it("chama onConfirm ao clicar em Confirmar", () => {
    const onConfirm = vi.fn();
    render(
      <AddonConfirmModal
        open={true}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    screen.getByRole("button", { name: "Confirmar" }).click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("chama onCancel ao clicar em Cancelar", () => {
    const onCancel = vi.fn();
    render(
      <AddonConfirmModal
        open={true}
        pacoteNome="Clássico"
        valorBase={2200}
        valorAddon={500}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    screen.getByRole("button", { name: "Cancelar" }).click();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AddonConfirmModal.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component's CSS module**

Create `src/components/AddonConfirmModal.module.css`:

```css
.dialogo {
  border: 1px solid var(--paper-border);
  padding: var(--space-lg);
  max-width: 400px;
  width: 90vw;
}

.dialogo::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.titulo {
  font-family: var(--font-display);
  font-size: 1.1rem;
  margin: 0 0 var(--space-md);
}

.total {
  font-family: var(--font-display);
  color: var(--wine);
  font-size: 1.05rem;
  margin-top: var(--space-sm);
}

.acoes {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.botaoCancelar {
  flex: 1;
  background: #fff;
  border: 1px solid var(--paper-border);
  padding: 0.6rem 1rem;
  cursor: pointer;
}

.botaoConfirmar {
  flex: 1;
  background: var(--wine);
  color: var(--paper);
  border: none;
  padding: 0.6rem 1rem;
  cursor: pointer;
}
```

- [ ] **Step 4: Write the component**

Create `src/components/AddonConfirmModal.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import styles from "./AddonConfirmModal.module.css";

interface AddonConfirmModalProps {
  open: boolean;
  pacoteNome: string;
  valorBase: number;
  valorAddon: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AddonConfirmModal({
  open,
  pacoteNome,
  valorBase,
  valorAddon,
  onConfirm,
  onCancel,
}: AddonConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.open = true;
      }
    } else if (!open && dialog.open) {
      try {
        dialog.close();
      } catch {
        dialog.open = false;
      }
    }
  }, [open]);

  const valorTotal = valorBase + valorAddon;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialogo}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h3 className={styles.titulo}>Confirmar Telão &amp; Projetor</h3>
      <p>
        {pacoteNome} — R$ {valorBase.toFixed(2)}
      </p>
      <p>Telão &amp; Projetor — R$ {valorAddon.toFixed(2)}</p>
      <p className={styles.total}>Total: R$ {valorTotal.toFixed(2)}</p>
      <div className={styles.acoes}>
        <button type="button" className={styles.botaoCancelar} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={styles.botaoConfirmar} onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/AddonConfirmModal.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Integrate into `ReservaEventoWizard.tsx`**

Add the import (alongside `EventAvailabilityCalendar`):

```tsx
import { EventAvailabilityCalendar } from "@/components/EventAvailabilityCalendar";
import { AddonConfirmModal } from "@/components/AddonConfirmModal";
```

Add a new piece of state near the other `useState` declarations (after `equipamentoTelao`):

```tsx
  const [equipamentoTelao, setEquipamentoTelao] = useState(false);
  const [modalAddonAberto, setModalAddonAberto] = useState(false);
```

Replace the checkbox:

```tsx
          <label className={styles.opcaoPacote}>
            <input
              type="checkbox"
              checked={equipamentoTelao}
              onChange={(e) => setEquipamentoTelao(e.target.checked)}
            />
            Telão &amp; Projetor (+R$ 500,00)
          </label>
```

with:

```tsx
          <label className={styles.opcaoPacote}>
            <input
              type="checkbox"
              checked={equipamentoTelao}
              onChange={(e) => {
                if (e.target.checked) {
                  setModalAddonAberto(true);
                } else {
                  setEquipamentoTelao(false);
                }
              }}
            />
            Telão &amp; Projetor (+R$ 500,00)
          </label>
```

Then add the modal itself right after the "pacote" step's closing `</fieldset>` (still inside the `{etapa === "pacote" && (...)}` block, as a sibling of the `<fieldset>`), replacing:

```tsx
      {etapa === "pacote" && (
        <fieldset className={styles.fieldset}>
          <legend>Escolha o pacote</legend>
          {pacotes.map((pacote) => (
            <label key={pacote.id} className={styles.opcaoPacote}>
              <input
                type="radio"
                name="pacote"
                checked={pacoteId === pacote.id}
                onChange={() => {
                  setCardapioAberto(pacote.precoPessoa === null);
                  setPacoteId(pacote.id);
                }}
              />
              {pacote.nome}
              {pacote.precoPessoa !== null
                ? ` — R$ ${pacote.precoPessoa.toFixed(2)}/pessoa (estimado: R$ ${calcularValorEstimado(pacote).toFixed(2)})`
                : " — orçamento sob consulta"}
            </label>
          ))}
          <label className={styles.opcaoPacote}>
            <input
              type="checkbox"
              checked={equipamentoTelao}
              onChange={(e) => {
                if (e.target.checked) {
                  setModalAddonAberto(true);
                } else {
                  setEquipamentoTelao(false);
                }
              }}
            />
            Telão &amp; Projetor (+R$ 500,00)
          </label>
          <button
            type="button"
            className={styles.botaoPrimario}
            onClick={escolherPacote}
            disabled={!pacoteId || carregando}
          >
            {cardapioAberto ? "Solicitar orçamento" : "Continuar para pagamento"}
          </button>
        </fieldset>
      )}
```

with:

```tsx
      {etapa === "pacote" && (
        <fieldset className={styles.fieldset}>
          <legend>Escolha o pacote</legend>
          {pacotes.map((pacote) => (
            <label key={pacote.id} className={styles.opcaoPacote}>
              <input
                type="radio"
                name="pacote"
                checked={pacoteId === pacote.id}
                onChange={() => {
                  setCardapioAberto(pacote.precoPessoa === null);
                  setPacoteId(pacote.id);
                }}
              />
              {pacote.nome}
              {pacote.precoPessoa !== null
                ? ` — R$ ${pacote.precoPessoa.toFixed(2)}/pessoa (estimado: R$ ${calcularValorEstimado(pacote).toFixed(2)})`
                : " — orçamento sob consulta"}
            </label>
          ))}
          <label className={styles.opcaoPacote}>
            <input
              type="checkbox"
              checked={equipamentoTelao}
              onChange={(e) => {
                if (e.target.checked) {
                  setModalAddonAberto(true);
                } else {
                  setEquipamentoTelao(false);
                }
              }}
            />
            Telão &amp; Projetor (+R$ 500,00)
          </label>
          <button
            type="button"
            className={styles.botaoPrimario}
            onClick={escolherPacote}
            disabled={!pacoteId || carregando}
          >
            {cardapioAberto ? "Solicitar orçamento" : "Continuar para pagamento"}
          </button>

          <AddonConfirmModal
            open={modalAddonAberto}
            pacoteNome={pacotes.find((pacote) => pacote.id === pacoteId)?.nome ?? ""}
            valorBase={
              pacotes.find((pacote) => pacote.id === pacoteId)?.precoPessoa !== null &&
              pacotes.find((pacote) => pacote.id === pacoteId)?.precoPessoa !== undefined
                ? (pacotes.find((pacote) => pacote.id === pacoteId)!.precoPessoa as number) *
                  numConvidados *
                  1.1
                : 0
            }
            valorAddon={VALOR_TELAO_PROJETOR}
            onConfirm={() => {
              setEquipamentoTelao(true);
              setModalAddonAberto(false);
            }}
            onCancel={() => setModalAddonAberto(false)}
          />
        </fieldset>
      )}
```

- [ ] **Step 7: Run the wizard test to verify it still passes**

Run: `npx vitest run src/app/reservar-evento/ReservaEventoWizard.test.tsx`
Expected: PASS — existing tests never check the checkbox, so this is a regression check, not new coverage.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/AddonConfirmModal.tsx src/components/AddonConfirmModal.module.css src/components/AddonConfirmModal.test.tsx src/app/reservar-evento/ReservaEventoWizard.tsx
git commit -m "feat: confirma add-on de Telão e Projetor com modal antes de aplicar o custo"
```

---

### Task 5: Occupied tables in `tableAvailability`/`tableFit`

**Files:**
- Modify: `src/lib/domain/tableFit.ts`
- Modify: `src/lib/domain/tableAvailability.ts`
- Modify: `src/lib/domain/tableAvailability.test.ts`
- Modify: `src/app/api/mesas-disponiveis/route.test.ts`

**Interfaces:**
- Produces: `MesaClassificada.faixa` widens from `"ideal" | "alternativa"` to `"ideal" | "alternativa" | "ocupada"`. `MesaDisponivel` (in `src/types/reservaMesa.ts`) inherits this automatically since it `extends MesaClassificada` — no edit needed there.
- Produces: `buscarMesasDisponiveis(params): Promise<MesaDisponivel[]>` now returns occupied tables (tagged `faixa: "ocupada"`) interleaved with available ones, instead of excluding them. Consumed by `ReservaMesaWizard.tsx` in Task 6.

- [ ] **Step 1: Write the failing tests**

In `src/lib/domain/tableAvailability.test.ts`, replace the first test:

```ts
  it("retorna só a mesa livre, excluindo a já reservada na data", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data, numPessoas: 2 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].numero).toBe("T01");
  });
```

with:

```ts
  it("retorna a mesa livre como disponível e a reservada como ocupada", async () => {
    const resultado = await buscarMesasDisponiveis({ ambienteId, data, numPessoas: 2 });
    expect(resultado).toHaveLength(2);

    const livre = resultado.find((mesa) => mesa.numero === "T01");
    const reservada = resultado.find((mesa) => mesa.numero === "T02");

    expect(livre?.faixa).not.toBe("ocupada");
    expect(reservada?.faixa).toBe("ocupada");
  });
```

Then, at the end of the second describe block (`"buscarMesasDisponiveis - filtro por diasSemanaAtivos (mesas duplas do Deck)"`), add a new test right before its closing `});`:

```ts

  it("mesa reservada na terça não aparece ocupada ao consultar o mesmo número de mesa num sábado (registro diferente)", async () => {
    await prisma.reservaMesa.create({
      data: {
        mesaId: mesaDomingoQuintaId,
        nomeCliente: "Cliente Teste Deck",
        telefone: "+5541999999999",
        data: terca,
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });

    const resultadoTerca = await buscarMesasDisponiveis({ ambienteId, data: terca, numPessoas: 2 });
    expect(resultadoTerca).toHaveLength(1);
    expect(resultadoTerca[0].faixa).toBe("ocupada");
    expect(resultadoTerca[0].id).toBe(mesaDomingoQuintaId);

    const resultadoSabado = await buscarMesasDisponiveis({ ambienteId, data: sabado, numPessoas: 2 });
    expect(resultadoSabado).toHaveLength(1);
    expect(resultadoSabado[0].faixa).not.toBe("ocupada");
    expect(resultadoSabado[0].id).toBe(mesaSextaSabadoId);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/domain/tableAvailability.test.ts`
Expected: FAIL — current implementation excludes the reserved table (`resultado` has length 1, not 2) and never sets `faixa: "ocupada"`.

- [ ] **Step 3: Widen the `MesaClassificada` type**

In `src/lib/domain/tableFit.ts`, replace:

```ts
export interface MesaClassificada extends MesaCandidata {
  faixa: "ideal" | "alternativa";
}
```

with:

```ts
export interface MesaClassificada extends MesaCandidata {
  faixa: "ideal" | "alternativa" | "ocupada";
}
```

No other change to `tableFit.ts` — `classificarMesasPorCapacidade` and `selecionarMesasParaExibir` only ever produce `"ideal"`/`"alternativa"`, both still valid members of the widened union.

- [ ] **Step 4: Rewrite `buscarMesasDisponiveis`**

Replace `src/lib/domain/tableAvailability.ts` entirely with:

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

  // Mesas duplas do Deck (11, 12, 21) existem como dois registros de Mesa com o
  // mesmo número, cada um ativo em dias da semana diferentes (ex.: um registro
  // domingo-quinta, outro sexta/sábado). Sem este filtro, os dois apareceriam
  // como disponíveis (ou ocupados) todos os dias.
  const diaDaSemana = data.getDay();
  const mesasAtivasNoDia = mesasDoAmbiente.filter((mesa) =>
    mesa.diasSemanaAtivos.includes(diaDaSemana)
  );

  // Mesa pequena demais pro grupo nunca aparece, nem como ocupada.
  const mesasComCapacidade = mesasAtivasNoDia.filter(
    (mesa) => mesa.capacidadeLugares >= numPessoas
  );

  const reservasConfirmadas = await prisma.reservaMesa.findMany({
    where: {
      data,
      status: "CONFIRMADA",
      mesaId: { in: mesasComCapacidade.map((mesa) => mesa.id) },
    },
    select: { mesaId: true },
  });

  const mesasReservadasIds = new Set(reservasConfirmadas.map((r) => r.mesaId));
  const mesasLivres = mesasComCapacidade.filter((mesa) => !mesasReservadasIds.has(mesa.id));
  const mesasOcupadas = mesasComCapacidade.filter((mesa) => mesasReservadasIds.has(mesa.id));

  const classificadas = selecionarMesasParaExibir(
    mesasLivres.map((mesa) => ({ id: mesa.id, capacidadeLugares: mesa.capacidadeLugares })),
    numPessoas
  );

  const mesasLivresClassificadas: MesaDisponivel[] = classificadas.map((mesaClassificada) => {
    const mesaOriginal = mesasLivres.find((mesa) => mesa.id === mesaClassificada.id)!;
    return {
      ...mesaClassificada,
      numero: mesaOriginal.numero,
      ambienteId: mesaOriginal.ambienteId,
    };
  });

  const mesasOcupadasClassificadas: MesaDisponivel[] = mesasOcupadas.map((mesa) => ({
    id: mesa.id,
    capacidadeLugares: mesa.capacidadeLugares,
    faixa: "ocupada",
    numero: mesa.numero,
    ambienteId: mesa.ambienteId,
  }));

  return [...mesasLivresClassificadas, ...mesasOcupadasClassificadas];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/domain/tableAvailability.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Add an occupied-table test to the route test**

In `src/app/api/mesas-disponiveis/route.test.ts`, add a new test right before the describe block's closing `});`:

```ts

  it("inclui mesas ocupadas na resposta, marcadas com faixa 'ocupada'", async () => {
    const mesaOcupada = await prisma.mesa.create({
      data: { ambienteId, numero: "R02", capacidadeLugares: 4 },
    });
    await prisma.reservaMesa.create({
      data: {
        mesaId: mesaOcupada.id,
        nomeCliente: "Cliente Ocupado",
        telefone: "+5541999999998",
        data: new Date(`${data}T00:00:00`),
        horarioChegada: "19:30",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });

    const params = new URLSearchParams({ ambienteId, data, numPessoas: "2" });
    const request = new NextRequest(`http://localhost/api/mesas-disponiveis?${params}`);
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const mesaR02 = body.mesas.find((m: { numero: string }) => m.numero === "R02");
    expect(mesaR02.faixa).toBe("ocupada");

    await prisma.reservaMesa.deleteMany({ where: { mesaId: mesaOcupada.id } });
    await prisma.mesa.delete({ where: { id: mesaOcupada.id } });
  });
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/app/api/mesas-disponiveis/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/domain/tableFit.ts src/lib/domain/tableAvailability.ts src/lib/domain/tableAvailability.test.ts src/app/api/mesas-disponiveis/route.test.ts
git commit -m "feat: inclui mesas ocupadas na resposta de disponibilidade, em vez de excluí-las"
```

---

### Task 6: Occupied tables on the `ReservaMesaWizard` map and list

**Files:**
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.tsx`
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.module.css`
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.test.tsx`

**Interfaces:**
- Consumes: `MesaDisponivel.faixa: "ideal" | "alternativa" | "ocupada"` from Task 5.

- [ ] **Step 1: Write the failing test**

In `src/app/reservar-mesa/ReservaMesaWizard.test.tsx`, add a new test inside the first `describe("ReservaMesaWizard", ...)` block, right before its closing `});`:

```tsx

  it("não permite selecionar uma mesa ocupada mesmo simulando o clique", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().includes("/api/horarios-disponiveis")) {
          return new Response(JSON.stringify({ horarios: ["18:30", "19:00"] }), { status: 200 });
        }
        if (url.toString().includes("/api/mesas-disponiveis")) {
          return new Response(
            JSON.stringify({
              mesas: [
                { id: "mesa_livre", numero: "1", capacidadeLugares: 4, faixa: "ideal", ambienteId: "amb_1" },
                { id: "mesa_ocupada", numero: "2", capacidadeLugares: 4, faixa: "ocupada", ambienteId: "amb_1" },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ erro: "rota não mockada" }), { status: 404 });
      })
    );

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

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByText("Escolher mesa"));

    const botaoOcupada = await screen.findByRole("button", { name: /Mesa 2 — 4 lugares/ });
    expect(botaoOcupada).toBeDisabled();
    expect(botaoOcupada).not.toHaveAttribute("aria-pressed");

    fireEvent.click(botaoOcupada);

    expect(screen.getByText("Continuar")).toBeDisabled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/reservar-mesa/ReservaMesaWizard.test.tsx`
Expected: FAIL — the occupied table currently renders as a normal enabled button, so "Continuar" becomes enabled after the click.

- [ ] **Step 3: Update the map rendering**

In `src/app/reservar-mesa/ReservaMesaWizard.tsx`, replace:

```tsx
            {zonasPorAmbiente[ambienteSelecionadoId]
              ?.filter((zona) => mesasDisponiveis.some((mesa) => mesa.id === zona.mesaId))
              .map((zona) => (
                <button
                  key={zona.mesaId}
                  type="button"
                  className={styles.mesaNoMapa}
                  style={{
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
```

with:

```tsx
            {zonasPorAmbiente[ambienteSelecionadoId]
              ?.filter((zona) => mesasDisponiveis.some((mesa) => mesa.id === zona.mesaId))
              .map((zona) => {
                const mesa = mesasDisponiveis.find((m) => m.id === zona.mesaId);
                const ocupada = mesa?.faixa === "ocupada";
                return (
                  <button
                    key={zona.mesaId}
                    type="button"
                    className={`${styles.mesaNoMapa} ${ocupada ? styles.mesaOcupada : ""}`}
                    style={{
                      left: `${zona.coordenadas.x}%`,
                      top: `${zona.coordenadas.y}%`,
                      width: `${zona.coordenadas.largura}%`,
                      height: `${zona.coordenadas.altura}%`,
                    }}
                    aria-pressed={ocupada ? undefined : zona.mesaId === mesaSelecionadaId}
                    disabled={ocupada}
                    onClick={() => setMesaSelecionadaId(zona.mesaId)}
                  >
                    Mesa {zona.numero}
                  </button>
                );
              })}
```

- [ ] **Step 4: Update the accessible list rendering**

Replace:

```tsx
          <ul className={styles.listaMesas}>
            {mesasDisponiveis.map((mesa) => (
              <li key={mesa.id}>
                <button
                  type="button"
                  className={styles.botaoMesa}
                  aria-pressed={mesa.id === mesaSelecionadaId}
                  onClick={() => setMesaSelecionadaId(mesa.id)}
                >
                  Mesa {mesa.numero} — {mesa.capacidadeLugares} lugares
                  {mesa.faixa === "alternativa" ? " (maior que o ideal para o grupo)" : ""}
                </button>
              </li>
            ))}
          </ul>
```

with:

```tsx
          <ul className={styles.listaMesas}>
            {mesasDisponiveis.map((mesa) => {
              const ocupada = mesa.faixa === "ocupada";
              return (
                <li key={mesa.id}>
                  <button
                    type="button"
                    className={`${styles.botaoMesa} ${ocupada ? styles.mesaOcupada : ""}`}
                    aria-pressed={ocupada ? undefined : mesa.id === mesaSelecionadaId}
                    disabled={ocupada}
                    onClick={() => setMesaSelecionadaId(mesa.id)}
                  >
                    Mesa {mesa.numero} — {mesa.capacidadeLugares} lugares
                    {mesa.faixa === "alternativa" ? " (maior que o ideal para o grupo)" : ""}
                    {ocupada ? " (ocupada)" : ""}
                  </button>
                </li>
              );
            })}
          </ul>
```

- [ ] **Step 5: Add the `.mesaOcupada` CSS rule**

In `src/app/reservar-mesa/ReservaMesaWizard.module.css`, add at the very end of the file (after `.botaoMesa[aria-pressed="true"]`, so it wins the source-order tie-break against `.mesaNoMapa`/`.botaoMesa` without needing `!important`):

```css

.mesaOcupada {
  background: rgba(0, 0, 0, 0.15);
  color: var(--text-on-paper);
  border-color: var(--paper-border);
  cursor: not-allowed;
  opacity: 0.6;
}

.mesaOcupada:hover {
  background: rgba(0, 0, 0, 0.15);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/app/reservar-mesa/ReservaMesaWizard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/reservar-mesa/ReservaMesaWizard.tsx src/app/reservar-mesa/ReservaMesaWizard.module.css src/app/reservar-mesa/ReservaMesaWizard.test.tsx
git commit -m "feat: mostra mesas ocupadas acinzentadas e não-clicáveis no mapa e na lista"
```

---

### Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit/integration test suite**

Run: `npm test`
Expected: all test files pass, including every file touched in Tasks 1-6. Re-run once if the process looks truncated (this project has a known intermittent Node segfault on Windows that occurs *after* results are printed — verify by reading the final "Test Files X passed (X)" summary line, not just process exit).

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run E2E tests**

Run: `npm run test:e2e`
Expected: `e2e/reserva-evento.spec.ts` and `e2e/reserva-mesa.spec.ts` both pass. `reserva-mesa.spec.ts` needed no code changes (its single seeded table is never reserved by another actor in the test, so it's never "ocupada"); `reserva-evento.spec.ts` was updated in Task 3, Step 13.

- [ ] **Step 4: Manual spot-check against acceptance criteria**

Walk through `docs/superpowers/specs/2026-08-11-melhorias-app-design.md`'s "Critérios de aceitação" against the running app (`npm run dev`):
- Cardápio link in nav, home, and footer opens `https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital`.
- No price appears on any "Destaques do cardápio" card.
- `/reservar-evento` shows the calendar with occupied dates visually distinct and unclickable before any other field is filled.
- Checking "Telão & Projetor" always opens the confirmation modal; unchecking does not.
- `/reservar-mesa` shows occupied tables greyed out and unclickable on both the map and the list, respecting the Deck's per-weekday registries.

- [ ] **Step 5: Commit (only if Step 4 required fixes)**

If manual verification surfaced no issues, there is nothing to commit for this task. If it did, fix, re-run Steps 1-3, then:

```bash
git add -A
git commit -m "fix: ajustes de verificação final do lote de melhorias"
```

---

## Self-Review

**Spec coverage:**
- §1 (link do cardápio + preços) → Task 1. ✅
- §2 (calendário de evento) → Tasks 2 + 3. ✅
- §3 (modal de add-on) → Task 4. ✅
- §4 (mesas ocupadas no mapa) → Tasks 5 + 6. ✅
- "Testes e verificação" section → covered per-task (component/domain/route tests) plus Task 7 for the full-suite/E2E/manual pass. ✅
- "Critérios de aceitação" → explicitly checked in Task 7, Step 4. ✅

**Placeholder scan:** no TBD/TODO, no "add appropriate handling" phrasing, no "similar to Task N" shortcuts — every step has complete, copy-pasteable code or an exact search/replace pair.

**Type consistency:**
- `MesaClassificada.faixa` widened once in `tableFit.ts` (Task 5) and used consistently as `"ocupada"` in `tableAvailability.ts`, `ReservaMesaWizard.tsx` (Task 6), and the corresponding tests — no divergent spelling.
- `EventAvailabilityCalendar`'s `{ value, onChange }` props (Task 3) match exactly how `ReservaEventoWizard.tsx` invokes it (`value={data} onChange={setData}`).
- `AddonConfirmModal`'s props (Task 4) match exactly how `ReservaEventoWizard.tsx` invokes it.
- `NOMES_MESES` and `EstadoDia`/`DiaGrade` are defined once in `eventCalendarGrid.ts` (Task 3) and imported everywhere else that needs them (component, component test, wizard test, E2E spec) rather than redefined — avoids drift.
- `GET /api/eventos/disponibilidade-mes`'s `{ datasOcupadas: string[] }` response shape (Task 2) matches exactly what `EventAvailabilityCalendar` reads (Task 3, `corpo.datasOcupadas ?? []`).
