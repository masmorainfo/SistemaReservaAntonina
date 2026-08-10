# Frontend Público — Identidade Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar identidade visual real ao frontend público do Antonina Osteria — uma home nova (hoje é um placeholder vazio) e o reskin das duas telas de reserva já funcionais (`/reservar-mesa`, `/reservar-evento`), sem alterar nenhum comportamento/lógica existente.

**Architecture:** CSS puro com custom properties (design tokens) + CSS Modules por componente/página, sem nenhum framework de UI novo. Quatro componentes compartilhados (`SiteNav`, `Footer`, `DishCard`, `WizardProgress`) usados pelas três páginas públicas. Fotos reais baixadas do Instagram oficial da marca.

**Tech Stack:** Next.js 15 App Router · React 18 · CSS Modules · `next/font/google` · `next/image` · Vitest + React Testing Library (ambiente `jsdom` por arquivo de teste) · Playwright (E2E existente, não deve quebrar)

## Pré-requisitos

Este plano assume que `docs/superpowers/specs/2026-08-10-frontend-publico-design.md` foi lida e aprovada. Assume também que os planos de Fase 1 e o de Mercado Pago Pix já foram executados — o sistema de reservas está funcionalmente completo, este plano só adiciona a camada visual.

## Global Constraints

- Nenhuma dependência de UI framework nova (Tailwind, Radix, etc.) entra em `package.json`. Estilo é CSS puro com custom properties + CSS Modules.
- Fontes carregadas via `next/font/google` (Fraunces, Work Sans) — nunca `<link>`/`@import` manual.
- Imagens via `next/image`, arquivos reais em `public/images/` (não placeholder/lorem picsum).
- **Zero mudança de comportamento** nos wizards de reserva — toda lógica (`useState`, `fetch`, validações) permanece idêntica. Só markup/estilo mudam.
- `role="alert"` e `role="status"` existentes nos wizards são preservados exatamente como estão.
- Painel admin (`/admin/*`) está fora de escopo deste plano.
- O link "Cardápio" da navegação aponta para `https://cardapio.pedyun.com.br/antoninaosteria` (nova aba) — o cardápio não é recriado dentro do site.
- **Uso de fotos do Instagram oficial (@antoninaosteria) para o próprio site do restaurante foi explicitamente autorizado pelo dono nesta conversa — não é necessário pedir permissão de novo ao executar a Task 6.**
- Os specs E2E existentes (`e2e/reserva-mesa.spec.ts`, `e2e/reserva-evento.spec.ts`) devem continuar passando sem que seus asserts precisem mudar — o reskin não altera texto visível nem estrutura de formulário, só aparência.
- Testes de componente novos usam React Testing Library com `// @vitest-environment jsdom` no topo do arquivo (a config global do Vitest usa `environment: "node"` — esse comentário sobrescreve por arquivo, sem afetar os testes existentes).

## Visão geral dos arquivos

```
src/
  styles/
    tokens.css                                  (novo)
  app/
    globals.css                                 (novo)
    layout.tsx                                  (modificado)
    page.tsx                                    (modificado)
    page.module.css                             (novo)
    page.test.tsx                                (novo)
    reservar-mesa/
      page.tsx                                  (modificado)
      page.module.css                           (novo)
      ReservaMesaWizard.tsx                      (modificado)
      ReservaMesaWizard.module.css                (novo)
      ReservaMesaWizard.test.tsx                  (novo)
    reservar-evento/
      page.tsx                                  (modificado)
      page.module.css                           (novo)
      ReservaEventoWizard.tsx                     (modificado)
      ReservaEventoWizard.module.css               (novo)
      ReservaEventoWizard.test.tsx                 (novo)
  components/
    SiteNav.tsx                                 (novo)
    SiteNav.module.css                          (novo)
    SiteNav.test.tsx                             (novo)
    Footer.tsx                                  (novo)
    Footer.module.css                           (novo)
    Footer.test.tsx                              (novo)
    DishCard.tsx                                (novo)
    DishCard.module.css                         (novo)
    DishCard.test.tsx                            (novo)
    WizardProgress.tsx                          (novo)
    WizardProgress.module.css                   (novo)
    WizardProgress.test.tsx                      (novo)
public/
  images/
    hero-fachada.jpg                            (novo, via download)
    prato-arancini.jpg                          (novo, via download)
    prato-burrata.jpg                           (novo, via download)
    prato-cacio-e-pepe.jpg                      (novo, via download)
    prato-banoffee.jpg                          (novo, via download)
    interior-salao.jpg                          (novo, via download)
    interior-terraco.jpg                        (novo, via download)
    mezanino.jpg                                (novo, via download)
```

---

### Task 1: Fundação — design tokens, reset global e fontes

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx` (arquivo inteiro, hoje tem 12 linhas)

**Interfaces:**
- Produces: as custom properties CSS (`--bg-dark`, `--bg-dark-elevated`, `--text-cream`, `--gold-accent`, `--wine`, `--paper`, `--paper-border`, `--text-on-paper`, `--font-display`, `--font-body`, escala de espaçamento) — consumidas por todos os CSS Modules das tasks seguintes.

- [ ] **Step 1: Criar os tokens de design**

`src/styles/tokens.css`:
```css
:root {
  /* Cores */
  --bg-dark: #1c1a1d;
  --bg-dark-elevated: #2c2226;
  --text-cream: #e8ded1;
  --gold-accent: #c9a24a;
  --wine: #5c3a3f;
  --paper: #f4efe9;
  --paper-border: #d8c9bd;
  --text-on-paper: #3d312c;

  /* Tipografia — as variáveis --font-fraunces e --font-work-sans são
     definidas pelo next/font em layout.tsx */
  --font-display: var(--font-fraunces), Georgia, "Times New Roman", serif;
  --font-body: var(--font-work-sans), -apple-system, BlinkMacSystemFont, sans-serif;

  /* Espaçamento */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2.5rem;
  --space-xl: 4rem;
  --space-section: clamp(3rem, 2rem + 4vw, 6rem);

  /* Layout */
  --container-max: 1200px;
}
```

- [ ] **Step 2: Criar o reset/base global**

`src/app/globals.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--text-on-paper);
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.5;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  margin: 0;
  line-height: 1.2;
}

a {
  color: inherit;
}

img {
  max-width: 100%;
  display: block;
}

.container {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0 var(--space-md);
}
```

- [ ] **Step 3: Ligar as fontes e os dois CSS globais no layout raiz**

Substitua o conteúdo de `src/app/layout.tsx`:
```tsx
import { Fraunces, Work_Sans } from "next/font/google";
import "@/styles/tokens.css";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-work-sans",
  display: "swap",
});

export const metadata = {
  title: "Antonina Osteria",
  description: "Reservas de mesa e eventos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${workSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verificar que nada quebrou**

Run: `npx tsc --noEmit && npm test`
Expected: ambos limpos — esta task não muda lógica nenhuma, só CSS/config.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/app/globals.css src/app/layout.tsx
git commit -m "feat: adiciona design tokens, reset global e fontes (Fraunces, Work Sans)"
```

---

### Task 2: Componente `SiteNav`

**Files:**
- Create: `src/components/SiteNav.tsx`
- Create: `src/components/SiteNav.module.css`
- Test: `src/components/SiteNav.test.tsx`

**Interfaces:**
- Consumes: tokens de `src/styles/tokens.css` (Task 1).
- Produces: `SiteNav` (componente sem props) — consumido pelas Tasks 7, 8 e 9.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/SiteNav.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteNav } from "./SiteNav";

describe("SiteNav", () => {
  it("renderiza o nome da marca como link para a home", () => {
    render(<SiteNav />);
    const logo = screen.getByRole("link", { name: "Antonina Osteria" });
    expect(logo).toHaveAttribute("href", "/");
  });

  it("linka Cardápio pro site externo, em nova aba, sem vazar referrer", () => {
    render(<SiteNav />);
    const link = screen.getByRole("link", { name: "Cardápio" });
    expect(link).toHaveAttribute("href", "https://cardapio.pedyun.com.br/antoninaosteria");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("linka Eventos e Contato para âncoras da home, mesmo em outras páginas", () => {
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/#eventos");
    expect(screen.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "/#contato");
  });

  it("tem os dois atalhos fixos de reserva", () => {
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Mesa" })).toHaveAttribute("href", "/reservar-mesa");
    expect(screen.getByRole("link", { name: "Evento" })).toHaveAttribute("href", "/reservar-evento");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- SiteNav`
Expected: FAIL — módulo `./SiteNav` não existe.

- [ ] **Step 3: Implementar**

`src/components/SiteNav.tsx`:
```tsx
import Link from "next/link";
import styles from "./SiteNav.module.css";

const CARDAPIO_URL = "https://cardapio.pedyun.com.br/antoninaosteria";

export function SiteNav() {
  return (
    <header className={styles.nav}>
      <div className={`${styles.inner} container`}>
        <Link href="/" className={styles.logo}>
          Antonina Osteria
        </Link>

        <nav className={styles.links} aria-label="Navegação principal">
          <a href={CARDAPIO_URL} target="_blank" rel="noopener noreferrer">
            Cardápio
          </a>
          <a href="/#eventos">Eventos</a>
          <a href="/#contato">Contato</a>
        </nav>

        <div className={styles.reservar} role="group" aria-label="Reservar">
          <Link href="/reservar-mesa" className={styles.reservarMesa}>
            Mesa
          </Link>
          <Link href="/reservar-evento" className={styles.reservarEvento}>
            Evento
          </Link>
        </div>
      </div>
    </header>
  );
}
```

`src/components/SiteNav.module.css`:
```css
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--bg-dark);
  border-bottom: 1px solid rgba(201, 162, 74, 0.25);
}

.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-sm);
  padding-bottom: var(--space-sm);
}

.logo {
  font-family: var(--font-display);
  color: var(--text-cream);
  font-size: 1.1rem;
  letter-spacing: 0.05em;
  text-decoration: none;
  white-space: nowrap;
}

.links {
  display: none;
  gap: var(--space-md);
  font-size: 0.85rem;
}

.links a {
  color: var(--text-cream);
  text-decoration: none;
  opacity: 0.85;
}

.links a:hover {
  opacity: 1;
  color: var(--gold-accent);
}

.reservar {
  display: flex;
  border: 1px solid var(--gold-accent);
  border-radius: 2px;
  overflow: hidden;
}

.reservarMesa,
.reservarEvento {
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-decoration: none;
  color: var(--text-cream);
  white-space: nowrap;
}

.reservarMesa {
  border-right: 1px solid var(--gold-accent);
}

.reservarMesa:hover,
.reservarEvento:hover {
  background: var(--gold-accent);
  color: var(--bg-dark);
}

@media (min-width: 768px) {
  .links {
    display: flex;
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- SiteNav`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/components/SiteNav.tsx src/components/SiteNav.module.css src/components/SiteNav.test.tsx
git commit -m "feat: adiciona SiteNav com atalhos fixos de reserva"
```

---

### Task 3: Componente `Footer`

**Files:**
- Create: `src/components/Footer.tsx`
- Create: `src/components/Footer.module.css`
- Test: `src/components/Footer.test.tsx`

**Interfaces:**
- Consumes: tokens de `src/styles/tokens.css` (Task 1).
- Produces: `Footer` (componente sem props) — consumido pelas Tasks 7, 8 e 9.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/Footer.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renderiza o endereço e o horário de funcionamento conhecido", () => {
    render(<Footer />);
    expect(screen.getByText(/Rua Vinicius Degani 161/)).toBeInTheDocument();
    expect(screen.getByText(/Terça a Sexta/)).toBeInTheDocument();
  });

  it("linka o Instagram oficial", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: /instagram/i });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/antoninaosteria/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("repete os atalhos de reserva", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Reservar Mesa" })).toHaveAttribute(
      "href",
      "/reservar-mesa"
    );
    expect(screen.getByRole("link", { name: "Reservar Evento" })).toHaveAttribute(
      "href",
      "/reservar-evento"
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- Footer`
Expected: FAIL — módulo `./Footer` não existe.

- [ ] **Step 3: Implementar**

`src/components/Footer.tsx`:
```tsx
import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer id="contato" className={styles.footer}>
      <div className={`${styles.inner} container`}>
        <div className={styles.bloco}>
          <p className={styles.marca}>Antonina Osteria</p>
          <p>Rua Vinicius Degani 161, Uberlândia — 38408-630</p>
        </div>

        <div className={styles.bloco}>
          <p className={styles.rotulo}>Horário</p>
          <p>Terça a Sexta — 18h30 às 23h30</p>
          <p>Sábados e feriados — 12h às 16h e 18h30 às 23h30</p>
          <p>Domingos e horários especiais: consulte o Instagram</p>
        </div>

        <div className={styles.bloco}>
          <p className={styles.rotulo}>Reservar</p>
          <Link href="/reservar-mesa">Reservar Mesa</Link>
          <Link href="/reservar-evento">Reservar Evento</Link>
        </div>

        <div className={styles.bloco}>
          <a
            href="https://www.instagram.com/antoninaosteria/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
```

`src/components/Footer.module.css`:
```css
.footer {
  background: var(--bg-dark);
  color: var(--text-cream);
  padding: var(--space-xl) 0;
}

.inner {
  display: grid;
  gap: var(--space-lg);
  grid-template-columns: 1fr;
}

.bloco p {
  margin: 0 0 var(--space-xs) 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.marca {
  font-family: var(--font-display);
  font-size: 1.1rem;
  opacity: 1 !important;
}

.rotulo {
  color: var(--gold-accent);
  font-size: 0.75rem !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 1 !important;
}

.bloco a {
  display: block;
  color: var(--text-cream);
  text-decoration: none;
  font-size: 0.9rem;
  margin-bottom: var(--space-xs);
  opacity: 0.85;
}

.bloco a:hover {
  opacity: 1;
  color: var(--gold-accent);
}

@media (min-width: 768px) {
  .inner {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- Footer`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx src/components/Footer.module.css src/components/Footer.test.tsx
git commit -m "feat: adiciona Footer com endereço, horário e redes"
```

---

### Task 4: Componente `DishCard`

**Files:**
- Create: `src/components/DishCard.tsx`
- Create: `src/components/DishCard.module.css`
- Test: `src/components/DishCard.test.tsx`

**Interfaces:**
- Consumes: tokens de `src/styles/tokens.css` (Task 1).
- Produces: `DishCard` com props `{ nome: string; descricao: string; preco: number; imagemSrc: string; imagemAlt: string }` — consumido pela Task 7.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/DishCard.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DishCard } from "./DishCard";

describe("DishCard", () => {
  it("renderiza nome, descrição, preço formatado e imagem com alt", () => {
    render(
      <DishCard
        nome="Arancini"
        descricao="Bolinho de risoto com molho de tomate pelado recheado com queijo."
        preco={42}
        imagemSrc="/images/prato-arancini.jpg"
        imagemAlt="Arancini servido em prato de madeira"
      />
    );

    expect(screen.getByText("Arancini")).toBeInTheDocument();
    expect(screen.getByText(/Bolinho de risoto/)).toBeInTheDocument();
    expect(screen.getByText("R$ 42.00")).toBeInTheDocument();
    expect(screen.getByAltText("Arancini servido em prato de madeira")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- DishCard`
Expected: FAIL — módulo `./DishCard` não existe.

- [ ] **Step 3: Implementar**

`src/components/DishCard.tsx`:
```tsx
import Image from "next/image";
import styles from "./DishCard.module.css";

interface DishCardProps {
  nome: string;
  descricao: string;
  preco: number;
  imagemSrc: string;
  imagemAlt: string;
}

export function DishCard({ nome, descricao, preco, imagemSrc, imagemAlt }: DishCardProps) {
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
      <p className={styles.preco}>R$ {preco.toFixed(2)}</p>
    </article>
  );
}
```

`src/components/DishCard.module.css`:
```css
.card {
  background: #fff;
  border: 1px solid var(--paper-border);
}

.imagem {
  width: 100%;
  height: 220px;
  object-fit: cover;
}

.nome {
  font-size: 1.05rem;
  padding: var(--space-sm) var(--space-sm) 0;
}

.descricao {
  font-size: 0.85rem;
  color: var(--text-on-paper);
  opacity: 0.8;
  padding: var(--space-xs) var(--space-sm) 0;
  margin: 0;
}

.preco {
  font-family: var(--font-display);
  color: var(--wine);
  font-size: 0.95rem;
  padding: var(--space-xs) var(--space-sm) var(--space-sm);
  margin: 0;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- DishCard`
Expected: PASS (1 teste)

- [ ] **Step 5: Commit**

```bash
git add src/components/DishCard.tsx src/components/DishCard.module.css src/components/DishCard.test.tsx
git commit -m "feat: adiciona DishCard para os destaques do cardápio"
```

---

### Task 5: Componente `WizardProgress`

**Files:**
- Create: `src/components/WizardProgress.tsx`
- Create: `src/components/WizardProgress.module.css`
- Test: `src/components/WizardProgress.test.tsx`

**Interfaces:**
- Consumes: tokens de `src/styles/tokens.css` (Task 1).
- Produces: `WizardProgress` com props `{ steps: WizardStep[]; currentKey: string }` e o tipo exportado `WizardStep = { key: string; label: string }` — consumidos pelas Tasks 8 e 9.

- [ ] **Step 1: Escrever o teste que falha**

`src/components/WizardProgress.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardProgress } from "./WizardProgress";

const PASSOS = [
  { key: "quando", label: "Quando" },
  { key: "onde", label: "Onde" },
  { key: "dados", label: "Dados" },
];

describe("WizardProgress", () => {
  it("renderiza todas as etapas e marca a atual com aria-current", () => {
    render(<WizardProgress steps={PASSOS} currentKey="onde" />);

    expect(screen.getByText("Quando")).toBeInTheDocument();
    expect(screen.getByText("Onde")).toBeInTheDocument();
    expect(screen.getByText("Dados")).toBeInTheDocument();

    const atual = screen.getByText("Onde").closest("li");
    expect(atual).toHaveAttribute("aria-current", "step");
  });

  it("não marca nenhuma etapa quando currentKey não bate com nenhum passo", () => {
    render(<WizardProgress steps={PASSOS} currentKey="confirmado" />);
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- WizardProgress`
Expected: FAIL — módulo `./WizardProgress` não existe.

- [ ] **Step 3: Implementar**

`src/components/WizardProgress.tsx`:
```tsx
import styles from "./WizardProgress.module.css";

export interface WizardStep {
  key: string;
  label: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentKey: string;
}

export function WizardProgress({ steps, currentKey }: WizardProgressProps) {
  return (
    <ol className={styles.progress} aria-label="Etapas da reserva">
      {steps.map((step) => (
        <li
          key={step.key}
          className={styles.step}
          aria-current={step.key === currentKey ? "step" : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}
```

`src/components/WizardProgress.module.css`:
```css
.progress {
  display: flex;
  gap: var(--space-md);
  list-style: none;
  margin: 0 0 var(--space-lg) 0;
  padding: 0;
}

.step {
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-on-paper);
  opacity: 0.45;
  padding-bottom: var(--space-xs);
  border-bottom: 2px solid transparent;
}

.step[aria-current="step"] {
  opacity: 1;
  color: var(--wine);
  border-bottom-color: var(--wine);
  font-weight: 500;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- WizardProgress`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/components/WizardProgress.tsx src/components/WizardProgress.module.css src/components/WizardProgress.test.tsx
git commit -m "feat: adiciona indicador de progresso reusável pros wizards"
```

---

### Task 6: Fotos reais do Instagram oficial

**Files:**
- Create: `public/images/hero-fachada.jpg`
- Create: `public/images/prato-arancini.jpg`
- Create: `public/images/prato-burrata.jpg`
- Create: `public/images/prato-cacio-e-pepe.jpg`
- Create: `public/images/prato-banoffee.jpg`
- Create: `public/images/interior-salao.jpg`
- Create: `public/images/interior-terraco.jpg`
- Create: `public/images/mezanino.jpg`

**Interfaces:**
- Produces: os 8 arquivos de imagem acima, em `public/images/` — consumidos pela Task 7 (home) por caminho exato (`/images/<nome>.jpg`).

O dono do restaurante autorizou explicitamente o uso de fotos da conta oficial `@antoninaosteria` para o próprio site do restaurante (não é necessário pedir permissão de novo).

- [ ] **Step 1: Abrir o Instagram oficial no navegador**

Carregue as ferramentas de browser (`ToolSearch` com `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_network_requests` se ainda não estiverem carregadas) e navegue para `https://www.instagram.com/antoninaosteria/`.

- [ ] **Step 2: Identificar e abrir posts que sirvam pra cada imagem**

Percorra o feed (grid de posts) e abra individualmente os posts que melhor representem cada assunto abaixo. Priorize fotos nítidas, bem enquadradas, sem muito texto sobreposto:

| Arquivo | Assunto |
|---|---|
| `hero-fachada.jpg` | Fachada do restaurante, de preferência ao entardecer/noite (janela do hero) |
| `prato-arancini.jpg` | Prato de Arancini (bolinho de risoto) |
| `prato-burrata.jpg` | Burrata al Pesto |
| `prato-cacio-e-pepe.jpg` | Massa Cacio e Pepe |
| `prato-banoffee.jpg` | Sobremesa Banoffee |
| `interior-salao.jpg` | Salão interno, mesas postas |
| `interior-terraco.jpg` | Área externa/terraço |
| `mezanino.jpg` | Espaço do Mezanino (eventos) |

Se algum prato específico não tiver post recente no feed, use uma foto de prato geral que transmita bem a categoria (ex.: qualquer massa da casa para `prato-cacio-e-pepe.jpg`) — o objetivo é representar o cardápio visualmente, não documentar o prato exato pixel a pixel.

- [ ] **Step 3: Para cada post aberto, capturar a URL real da imagem**

Com o post aberto em tela cheia, rode:

```
read_network_requests com urlPattern "cdninstagram" (ou "fbcdn" se não achar nada)
```

Procure a requisição de imagem (`.jpg`/`.webp`) de maior resolução na lista (geralmente a de maior `Content-Length` ou com `stp=` indicando dimensão grande no próprio URL). Anote a URL completa.

- [ ] **Step 4: Baixar cada imagem via curl, com User-Agent e Referer de navegador**

Para cada imagem, rode (trocando `<URL_REAL>` pela URL capturada e `<nome-arquivo>` pelo nome da tabela do Step 2):

```bash
cd "E:\evento antonina"
mkdir -p public/images
curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  -e "https://www.instagram.com/" \
  -o "public/images/<nome-arquivo>.jpg" \
  "<URL_REAL>"
```

- [ ] **Step 5: Verificar que os 8 arquivos baixaram de verdade**

Run:
```bash
cd "E:\evento antonina"
for f in public/images/*.jpg; do
  size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  echo "$f — ${size} bytes"
done
```
Expected: 8 arquivos listados, cada um com mais de ~15000 bytes (uma imagem real de post do Instagram nunca é menor que isso). Se algum arquivo vier muito pequeno ou vazio, o download falhou — volte ao Step 3 para aquele item específico e tente outra requisição da lista (o CDN às vezes serve um placeholder pequeno antes da imagem real carregar).

- [ ] **Step 6: Commit**

```bash
git add public/images/
git commit -m "feat: adiciona fotos reais do Instagram oficial do Antonina Osteria"
```

---

### Task 7: Home (`/`)

**Files:**
- Modify: `src/app/page.tsx` (arquivo inteiro, hoje é um placeholder de 3 linhas)
- Create: `src/app/page.module.css`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `SiteNav` (Task 2), `Footer` (Task 3), `DishCard` (Task 4), imagens de `public/images/` (Task 6).

- [ ] **Step 1: Escrever o teste que falha**

`src/app/page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("renderiza o hero com o nome da marca e a tagline", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Antonina Osteria" })).toBeInTheDocument();
    expect(screen.getByText(/1ª Osteria Tartuferia de Uberlândia/)).toBeInTheDocument();
  });

  it("tem as âncoras de Eventos e Contato que a SiteNav espera", () => {
    render(<HomePage />);
    expect(document.getElementById("eventos")).not.toBeNull();
    expect(document.getElementById("contato")).not.toBeNull();
  });

  it("renderiza os 4 pratos em destaque com link pro cardápio completo", () => {
    render(<HomePage />);
    expect(screen.getByText("Arancini")).toBeInTheDocument();
    expect(screen.getByText("Burrata al Pesto")).toBeInTheDocument();
    expect(screen.getByText("Cacio e Pepe")).toBeInTheDocument();
    expect(screen.getByText("Banoffee Antonina")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver cardápio completo" })).toHaveAttribute(
      "href",
      "https://cardapio.pedyun.com.br/antoninaosteria"
    );
  });

  it("tem as duas chamadas de reserva com nomes completos", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("link", { name: /Reservar Mesa/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Reservar Evento/i }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- app/page`
Expected: FAIL — a home atual não tem nenhum desse conteúdo (é só `<main>Antonina Osteria</main>`).

- [ ] **Step 3: Implementar**

Substitua o conteúdo de `src/app/page.tsx`:
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

const GALERIA = [
  { src: "/images/interior-salao.jpg", alt: "Salão interno do Antonina Osteria" },
  { src: "/images/interior-terraco.jpg", alt: "Terraço externo do Antonina Osteria" },
  { src: "/images/mezanino.jpg", alt: "Mezanino, espaço de eventos do Antonina Osteria" },
  { src: "/images/hero-fachada.jpg", alt: "Fachada do Antonina Osteria" },
];

export default function HomePage() {
  return (
    <>
      <SiteNav />

      <main>
        <section className={styles.hero}>
          <Image
            src="/images/hero-fachada.jpg"
            alt="Fachada do Antonina Osteria ao entardecer"
            fill
            priority
            className={styles.heroImagem}
          />
          <div className={styles.heroOverlay} />
          <div className={`${styles.heroConteudo} container`}>
            <h1 className={styles.heroTitulo}>Antonina Osteria</h1>
            <p className={styles.heroTagline}>1ª Osteria Tartuferia de Uberlândia</p>
            <p className={styles.heroSubtexto}>
              Cozinha italiana autoral com trufa em cada etapa do menu. Terça a domingo, no
              coração de Uberlândia.
            </p>
          </div>
        </section>

        <section className={`${styles.secaoPapel} container`}>
          <h2>Osteria Tartuferia</h2>
          <p className={styles.textoLongo}>
            Osteria Tartuferia significa um compromisso simples: trazer a trufa pra mesa em cada
            prato que faz sentido, sem exagero. No Antonina, isso vira arancini, burrata, massas
            feitas na casa e um andar de cima reservado pra celebrar — o Mezanino, nosso espaço de
            eventos.
          </p>
        </section>

        <section className={`${styles.secaoPapel} container`}>
          <h2>Destaques do cardápio</h2>
          <div className={styles.gradePratos}>
            {PRATOS_DESTAQUE.map((prato) => (
              <DishCard key={prato.nome} {...prato} />
            ))}
          </div>
          <a href={CARDAPIO_URL} target="_blank" rel="noopener noreferrer" className={styles.linkCardapio}>
            Ver cardápio completo
          </a>
        </section>

        <section className={`${styles.secaoPapel} container`}>
          <h2>O espaço</h2>
          <div className={styles.gradeGaleria}>
            {GALERIA.map((foto) => (
              <Image
                key={foto.src}
                src={foto.src}
                alt={foto.alt}
                width={400}
                height={300}
                className={styles.fotoGaleria}
              />
            ))}
          </div>
          <a
            href="https://my.matterport.com/show/?m=noadeK6Syis"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkTour}
          >
            Ver tour virtual 3D
          </a>
        </section>

        <section id="eventos" className={styles.secaoEscura}>
          <div className="container">
            <h2 className={styles.tituloEscuro}>Mezanino — eventos privados</h2>
            <p className={styles.textoEscuro}>
              O Mezanino é o nosso espaço para aniversários, jantares corporativos e celebrações
              fechadas — até 40 convidados, cardápio dedicado e equipamento de telão disponível.
              Reserve a data e cuidamos do resto.
            </p>
            <Link href="/reservar-evento" className={styles.botaoDourado}>
              Reservar Evento
            </Link>
          </div>
        </section>

        <section className={styles.secaoEscura}>
          <div className="container">
            <h2 className={styles.tituloEscuro}>Venha nos visitar</h2>
            <p className={styles.textoEscuro}>Rua Vinicius Degani 161, Uberlândia — 38408-630</p>
            <p className={styles.textoEscuro}>Terça a Sexta — 18h30 às 23h30</p>
            <p className={styles.textoEscuro}>
              Sábados e feriados — 12h às 16h e 18h30 às 23h30
            </p>
            <div className={styles.ctaFinal}>
              <Link href="/reservar-mesa" className={styles.botaoDourado}>
                Reservar Mesa
              </Link>
              <Link href="/reservar-evento" className={styles.botaoContorno}>
                Reservar Evento
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
```

- [ ] **Step 4: Escrever o CSS da home**

`src/app/page.module.css`:
```css
.hero {
  position: relative;
  min-height: 70vh;
  display: flex;
  align-items: flex-end;
  color: var(--text-cream);
}

.heroImagem {
  object-fit: cover;
  z-index: -2;
}

.heroOverlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(28, 26, 29, 0.35) 0%, rgba(28, 26, 29, 0.9) 100%);
  z-index: -1;
}

.heroConteudo {
  padding-bottom: var(--space-xl);
}

.heroTitulo {
  font-size: clamp(2.5rem, 2rem + 3vw, 4rem);
  letter-spacing: 0.03em;
}

.heroTagline {
  font-family: var(--font-display);
  font-style: italic;
  color: var(--gold-accent);
  font-size: 1.1rem;
  margin: var(--space-sm) 0 var(--space-sm);
}

.heroSubtexto {
  max-width: 40ch;
  opacity: 0.9;
}

.secaoPapel {
  padding: var(--space-section) var(--space-md);
}

.textoLongo {
  max-width: 65ch;
  font-size: 1.05rem;
}

.gradePratos {
  display: grid;
  gap: var(--space-md);
  grid-template-columns: 1fr;
  margin: var(--space-lg) 0;
}

.gradeGaleria {
  display: grid;
  gap: var(--space-sm);
  grid-template-columns: repeat(2, 1fr);
  margin: var(--space-lg) 0;
}

.fotoGaleria {
  width: 100%;
  height: 220px;
  object-fit: cover;
}

.linkCardapio,
.linkTour {
  display: inline-block;
  color: var(--wine);
  font-weight: 500;
  text-decoration: underline;
}

.secaoEscura {
  background: var(--bg-dark);
  color: var(--text-cream);
  padding: var(--space-section) var(--space-md);
  text-align: center;
}

.tituloEscuro {
  color: var(--text-cream);
  margin-bottom: var(--space-md);
}

.textoEscuro {
  max-width: 55ch;
  margin: 0 auto var(--space-xs);
  opacity: 0.9;
}

.ctaFinal {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  margin-top: var(--space-lg);
  flex-wrap: wrap;
}

.botaoDourado,
.botaoContorno {
  display: inline-block;
  padding: 0.75rem 1.75rem;
  text-decoration: none;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
}

.botaoDourado {
  background: var(--gold-accent);
  color: var(--bg-dark);
  font-weight: 600;
}

.botaoContorno {
  border: 1px solid var(--gold-accent);
  color: var(--text-cream);
}

@media (min-width: 768px) {
  .gradePratos {
    grid-template-columns: repeat(2, 1fr);
  }

  .gradeGaleria {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1024px) {
  .gradePratos {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- app/page`
Expected: PASS (4 testes)

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — nenhum outro arquivo depende da home.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css src/app/page.test.tsx
git commit -m "feat: implementa a home com identidade visual e conteúdo real"
```

---

### Task 8: Reskin de `/reservar-mesa`

**Files:**
- Modify: `src/app/reservar-mesa/page.tsx`
- Create: `src/app/reservar-mesa/page.module.css`
- Modify: `src/app/reservar-mesa/ReservaMesaWizard.tsx`
- Create: `src/app/reservar-mesa/ReservaMesaWizard.module.css`
- Test: `src/app/reservar-mesa/ReservaMesaWizard.test.tsx`

**Interfaces:**
- Consumes: `SiteNav` (Task 2), `Footer` (Task 3), `WizardProgress`/`WizardStep` (Task 5).
- **Nenhuma mudança de comportamento**: toda a lógica de `ReservaMesaWizard` (estados, `fetch`, validações) permanece idêntica — só adiciona classes CSS e o indicador de progresso.

- [ ] **Step 1: Escrever o teste que falha**

`src/app/reservar-mesa/ReservaMesaWizard.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReservaMesaWizard } from "./ReservaMesaWizard";

describe("ReservaMesaWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaMesaWizard ambientes={[]} zonasPorAmbiente={{}} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- ReservaMesaWizard`
Expected: FAIL — `ReservaMesaWizard` ainda não renderiza nenhum indicador de progresso.

- [ ] **Step 3: Implementar — `ReservaMesaWizard.tsx`**

Substitua o conteúdo de `src/app/reservar-mesa/ReservaMesaWizard.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";
import type { MesaDisponivel } from "@/types/reservaMesa";
import { WizardProgress, type WizardStep } from "@/components/WizardProgress";
import styles from "./ReservaMesaWizard.module.css";

interface Ambiente {
  id: string;
  nome: string;
}

interface ReservaMesaWizardProps {
  ambientes: Ambiente[];
  zonasPorAmbiente: Record<string, ZonaClicavel[]>;
}

type Etapa = "quando" | "onde" | "dados" | "confirmado";

const PASSOS: WizardStep[] = [
  { key: "quando", label: "Quando" },
  { key: "onde", label: "Onde" },
  { key: "dados", label: "Dados" },
];

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
    } catch {
      setErro("não foi possível conectar ao servidor para buscar horários");
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
    } catch {
      setErro("não foi possível conectar ao servidor para buscar mesas");
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
    } catch {
      setErro("não foi possível conectar ao servidor para confirmar a reserva");
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "confirmado") {
    const mesa = mesasDisponiveis.find((m) => m.id === mesaSelecionadaId);
    return (
      <p role="status" className={styles.mensagemSucesso}>
        Reserva confirmada para {nomeCliente} — mesa {mesa?.numero}, {data} às {horarioChegada}.
      </p>
    );
  }

  return (
    <div className={styles.wizard}>
      <WizardProgress steps={PASSOS} currentKey={etapa} />

      {erro && (
        <p role="alert" className={styles.mensagemErro}>
          {erro}
        </p>
      )}

      {etapa === "quando" && (
        <fieldset className={styles.fieldset}>
          <legend>Quando você quer vir?</legend>
          <label className={styles.campo}>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.botaoPrimario}
            onClick={buscarHorarios}
            disabled={!data || carregando}
          >
            Ver horários
          </button>

          {horarios.length > 0 && (
            <>
              <label className={styles.campo}>
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
              <label className={styles.campo}>
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
                className={styles.botaoPrimario}
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
        <fieldset className={styles.fieldset}>
          <legend>Onde você quer sentar?</legend>
          <div role="group" aria-label="Escolha o ambiente" className={styles.grupoAmbientes}>
            {ambientes.map((ambiente) => (
              <button
                key={ambiente.id}
                type="button"
                className={styles.botaoAmbiente}
                aria-pressed={ambiente.id === ambienteSelecionadoId}
                onClick={() => trocarAmbiente(ambiente.id)}
              >
                {ambiente.nome}
              </button>
            ))}
          </div>

          <div
            aria-label={`Mapa do ambiente ${ambientes.find((a) => a.id === ambienteSelecionadoId)?.nome ?? ""}`}
            className={styles.mapa}
          >
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
          </div>

          <p>Lista de mesas disponíveis (alternativa acessível ao mapa):</p>
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

          <button
            type="button"
            className={styles.botaoPrimario}
            onClick={() => setEtapa("dados")}
            disabled={!mesaSelecionadaId}
          >
            Continuar
          </button>
        </fieldset>
      )}

      {etapa === "dados" && (
        <fieldset className={styles.fieldset}>
          <legend>Seus dados</legend>
          <label className={styles.campo}>
            Nome
            <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Telefone
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.botaoPrimario}
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

- [ ] **Step 4: Escrever o CSS do wizard**

`src/app/reservar-mesa/ReservaMesaWizard.module.css`:
```css
.wizard {
  max-width: 560px;
}

.fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

.fieldset legend {
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-bottom: var(--space-md);
  padding: 0;
}

.campo {
  display: block;
  margin-bottom: var(--space-md);
  font-size: 0.85rem;
  color: var(--text-on-paper);
}

.campo input,
.campo select {
  display: block;
  width: 100%;
  margin-top: var(--space-xs);
  padding: 0.6rem 0.7rem;
  background: #fff;
  border: 1px solid var(--paper-border);
  font-family: var(--font-body);
  font-size: 0.95rem;
}

.botaoPrimario {
  background: var(--wine);
  color: var(--paper);
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  letter-spacing: 0.03em;
  cursor: pointer;
}

.botaoPrimario:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mensagemErro {
  border: 1px solid var(--wine);
  color: var(--wine);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
}

.mensagemSucesso {
  border: 1px solid var(--gold-accent);
  padding: var(--space-md);
  max-width: 560px;
}

.grupoAmbientes {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.botaoAmbiente {
  padding: 0.5rem 1rem;
  background: #fff;
  border: 1px solid var(--paper-border);
  cursor: pointer;
}

.botaoAmbiente[aria-pressed="true"] {
  background: var(--wine);
  color: var(--paper);
  border-color: var(--wine);
}

.mapa {
  position: relative;
  margin-bottom: var(--space-md);
  border: 1px solid var(--paper-border);
  aspect-ratio: 16 / 9;
}

.mesaNoMapa {
  position: absolute;
  background: rgba(92, 58, 63, 0.75);
  color: var(--paper);
  border: 1px solid var(--gold-accent);
  font-size: 0.7rem;
  cursor: pointer;
}

.mesaNoMapa[aria-pressed="true"] {
  background: var(--wine);
}

.listaMesas {
  list-style: none;
  padding: 0;
  margin-bottom: var(--space-md);
}

.botaoMesa {
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.8rem;
  margin-bottom: var(--space-xs);
  background: #fff;
  border: 1px solid var(--paper-border);
  cursor: pointer;
}

.botaoMesa[aria-pressed="true"] {
  border-color: var(--wine);
  background: rgba(92, 58, 63, 0.08);
}
```

- [ ] **Step 5: Envolver a página com `SiteNav`/`Footer` e o papel creme**

Substitua o conteúdo de `src/app/reservar-mesa/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { FallbackMapProvider } from "@/providers/tableMap/FallbackMapProvider";
import { carregarZonasDoAmbiente } from "@/lib/tableMap/loadZonesFromDb";
import { ReservaMesaWizard } from "./ReservaMesaWizard";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import styles from "./page.module.css";

// Esta página lê dados ao vivo via Prisma (lista de ambientes, coordenadas do
// mapa) a cada requisição. Prisma não é uma "dynamic API" do Next.js, então
// sem essa diretiva o `next build` renderizaria a página estaticamente uma
// única vez — congelando a lista de ambientes/mesas no build e exigindo banco
// acessível em build time.
export const dynamic = "force-dynamic";

// Mezanino é reservável apenas via o fluxo de Evento (plano futuro): o espaço
// é reconfigurável e não tem mesas fixas individualmente reserváveis no dia a
// dia. Ver docs/superpowers/plans/2026-08-04-reserva-mesa-diaria.md, seção
// "Suposições que este plano assume", item 1.
const AMBIENTE_EXCLUIDO_DA_RESERVA_DIARIA = "Mezanino";

export default async function ReservarMesaPage() {
  const ambientes = await prisma.ambiente.findMany({
    where: { nome: { not: AMBIENTE_EXCLUIDO_DA_RESERVA_DIARIA } },
    orderBy: { nome: "asc" },
  });

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
    <>
      <SiteNav />
      <main className={styles.pagina}>
        <div className="container">
          <h1 className={styles.titulo}>Reservar Mesa</h1>
          <ReservaMesaWizard
            ambientes={ambientes.map((a) => ({ id: a.id, nome: a.nome }))}
            zonasPorAmbiente={zonasPorAmbiente}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
```

`src/app/reservar-mesa/page.module.css`:
```css
.pagina {
  background: var(--paper);
  padding: var(--space-xl) 0;
  min-height: 60vh;
}

.titulo {
  font-size: 1.8rem;
  margin-bottom: var(--space-lg);
  color: var(--text-on-paper);
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- ReservaMesaWizard`
Expected: PASS (1 teste)

- [ ] **Step 7: Rodar a suíte inteira e o typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — nenhuma lógica de negócio mudou.

- [ ] **Step 8: Commit**

```bash
git add src/app/reservar-mesa/
git commit -m "feat: reskin de /reservar-mesa com identidade visual e indicador de progresso"
```

---

### Task 9: Reskin de `/reservar-evento`

**Files:**
- Modify: `src/app/reservar-evento/page.tsx`
- Create: `src/app/reservar-evento/page.module.css`
- Modify: `src/app/reservar-evento/ReservaEventoWizard.tsx`
- Create: `src/app/reservar-evento/ReservaEventoWizard.module.css`
- Test: `src/app/reservar-evento/ReservaEventoWizard.test.tsx`

**Interfaces:**
- Consumes: `SiteNav` (Task 2), `Footer` (Task 3), `WizardProgress`/`WizardStep` (Task 5).
- **Nenhuma mudança de comportamento**: toda a lógica de `ReservaEventoWizard` (estados, `fetch`, polling, validações) permanece idêntica.

- [ ] **Step 1: Escrever o teste que falha**

`src/app/reservar-evento/ReservaEventoWizard.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReservaEventoWizard } from "./ReservaEventoWizard";

describe("ReservaEventoWizard — indicador de progresso", () => {
  it("mostra 'Quando' como etapa atual ao carregar", () => {
    render(<ReservaEventoWizard pacotes={[]} />);
    const passoAtual = screen.getByText("Quando").closest("li");
    expect(passoAtual).toHaveAttribute("aria-current", "step");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- ReservaEventoWizard`
Expected: FAIL — `ReservaEventoWizard` ainda não renderiza nenhum indicador de progresso.

- [ ] **Step 3: Implementar — `ReservaEventoWizard.tsx`**

Substitua o conteúdo de `src/app/reservar-evento/ReservaEventoWizard.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { WizardProgress, type WizardStep } from "@/components/WizardProgress";
import styles from "./ReservaEventoWizard.module.css";

interface Pacote {
  id: string;
  nome: string;
  precoPessoa: number | null;
}

interface ReservaEventoWizardProps {
  pacotes: Pacote[];
}

interface DadosPix {
  qrCode: string;
  qrCodeBase64: string;
  expiraEm: string;
}

type TipoEvento = "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
type Etapa = "quando" | "pacote" | "orcamento" | "orcamentoEnviado" | "checkout" | "confirmado";

const VALOR_TELAO_PROJETOR = 500;

const PASSOS: WizardStep[] = [
  { key: "quando", label: "Quando" },
  { key: "pacote", label: "Pacote" },
  { key: "checkout", label: "Checkout" },
];

export function ReservaEventoWizard({ pacotes }: ReservaEventoWizardProps) {
  const [etapa, setEtapa] = useState<Etapa>("quando");
  const [data, setData] = useState("");
  const [tipoEvento, setTipoEvento] = useState<TipoEvento>("ANIVERSARIO");
  const [numConvidados, setNumConvidados] = useState(10);
  const [pacoteId, setPacoteId] = useState("");
  const [cardapioAberto, setCardapioAberto] = useState(false);
  const [equipamentoTelao, setEquipamentoTelao] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [reservaId, setReservaId] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [precisaCienciaCdc, setPrecisaCienciaCdc] = useState(false);
  const [cienciaAceita, setCienciaAceita] = useState(false);
  const [metodo, setMetodo] = useState<"pix" | "cartao">("pix");
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
  const [aguardandoPix, setAguardandoPix] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!aguardandoPix || !reservaId) return;

    const intervalId = setInterval(async () => {
      try {
        const resposta = await fetch(`/api/eventos/reservas/${reservaId}`);
        if (!resposta.ok) return;

        const corpo = await resposta.json();
        if (corpo.reserva?.status === "CONFIRMADA") {
          setAguardandoPix(false);
          setEtapa("confirmado");
        } else if (corpo.reserva?.status === "CANCELADA") {
          setAguardandoPix(false);
          setErro("O tempo limite para conclusão do pagamento expirou.");
        }
      } catch {
        // Ignora erros transitórios de rede no polling
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [aguardandoPix, reservaId]);

  function calcularValorEstimado(pacote: Pacote): number {
    if (pacote.precoPessoa === null) return 0;
    const subtotal = pacote.precoPessoa * numConvidados * 1.1;
    return Math.round((subtotal + (equipamentoTelao ? VALOR_TELAO_PROJETOR : 0)) * 100) / 100;
  }

  async function verificarDisponibilidade() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/eventos/disponibilidade?data=${data}`);
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível verificar disponibilidade");
        return;
      }
      if (corpo.disponivel) {
        setEtapa("pacote");
      } else {
        setErro("essa data já está reservada, escolha outra");
      }
    } catch {
      setErro("não foi possível conectar ao servidor para verificar disponibilidade");
    } finally {
      setCarregando(false);
    }
  }

  async function escolherPacote() {
    if (cardapioAberto) {
      setEtapa("orcamento");
      return;
    }

    if (!pacoteId) {
      setErro("escolha um pacote");
      return;
    }

    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/eventos/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNome,
          clienteTelefone,
          clienteEmail,
          tipoEvento,
          data,
          numConvidados,
          pacoteId,
          equipamentoTelao,
        }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível criar a reserva");
        if (resposta.status === 409) {
          setEtapa("quando");
        }
        return;
      }

      setReservaId(corpo.reserva.id);
      setValorTotal(Number(corpo.reserva.valorTotal));

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataEventoMeiaNoite = new Date(`${data}T00:00:00`);
      dataEventoMeiaNoite.setHours(0, 0, 0, 0);
      const diasAteEvento = Math.round(
        (dataEventoMeiaNoite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      );
      setPrecisaCienciaCdc(diasAteEvento < 7);

      setEtapa("checkout");
    } catch {
      setErro("não foi possível conectar ao servidor para criar a reserva");
    } finally {
      setCarregando(false);
    }
  }

  async function enviarPedidoOrcamento() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/eventos/orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNome,
          clienteTelefone,
          clienteEmail,
          tipoEvento,
          dataDesejada: data,
          numConvidados,
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json();
        setErro(corpo.erro ?? "não foi possível enviar o pedido de orçamento");
        return;
      }

      setEtapa("orcamentoEnviado");
    } catch {
      setErro("não foi possível conectar ao servidor para enviar o pedido de orçamento");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarPagamento() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/eventos/reservas/${reservaId}/pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodo, cienciaDireitoArrependimento: cienciaAceita }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível confirmar o pagamento");
        return;
      }

      if (corpo.dadosPix) {
        setDadosPix(corpo.dadosPix);
        setAguardandoPix(true);
      } else {
        setEtapa("confirmado");
      }
    } catch {
      setErro("não foi possível conectar ao servidor para confirmar o pagamento");
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "orcamentoEnviado") {
    return (
      <p role="status" className={styles.mensagemSucesso}>
        Pedido de orçamento enviado! Nossa equipe entrará em contato em breve.
      </p>
    );
  }

  if (etapa === "confirmado") {
    return (
      <p role="status" className={styles.mensagemSucesso}>
        Evento confirmado para {clienteNome} em {data}. Em breve você recebe o link para escolher
        os pratos do cardápio.
      </p>
    );
  }

  const mostraProgresso = etapa === "quando" || etapa === "pacote" || etapa === "checkout";

  return (
    <div className={styles.wizard}>
      {mostraProgresso && <WizardProgress steps={PASSOS} currentKey={etapa} />}

      {erro && (
        <p role="alert" className={styles.mensagemErro}>
          {erro}
        </p>
      )}

      {etapa === "quando" && (
        <fieldset className={styles.fieldset}>
          <legend>Sobre o seu evento</legend>
          <label className={styles.campo}>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Tipo de evento
            <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value as TipoEvento)}>
              <option value="CORPORATIVO">Corporativo</option>
              <option value="ANIVERSARIO">Aniversário</option>
              <option value="JANTAR_RESERVADO">Jantar reservado</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label className={styles.campo}>
            Número de convidados (até 40)
            <input
              type="number"
              min={1}
              max={40}
              value={numConvidados}
              onChange={(e) => setNumConvidados(Number(e.target.value))}
            />
          </label>
          <label className={styles.campo}>
            Nome
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Telefone
            <input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} />
          </label>
          <label className={styles.campo}>
            E-mail
            <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.botaoPrimario}
            onClick={verificarDisponibilidade}
            disabled={
              !data || !clienteNome.trim() || !clienteTelefone.trim() || !clienteEmail.trim() || carregando
            }
          >
            Verificar disponibilidade
          </button>
        </fieldset>
      )}

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
              onChange={(e) => setEquipamentoTelao(e.target.checked)}
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

      {etapa === "orcamento" && (
        <fieldset className={styles.fieldset}>
          <legend>Pedido de orçamento — Cardápio Aberto</legend>
          <p>Sua data, tipo de evento e número de convidados já foram registrados. Confirme o envio:</p>
          <button
            type="button"
            className={styles.botaoPrimario}
            onClick={enviarPedidoOrcamento}
            disabled={carregando}
          >
            Enviar pedido de orçamento
          </button>
        </fieldset>
      )}

      {etapa === "checkout" && (
        <fieldset className={styles.fieldset}>
          <legend>Pagamento</legend>
          <p className={styles.valorTotal}>Valor total: R$ {valorTotal.toFixed(2)}</p>
          <label className={styles.opcaoPacote}>
            <input type="radio" name="metodo" checked={metodo === "pix"} onChange={() => setMetodo("pix")} />
            Pix
          </label>
          <label className={styles.opcaoPacote}>
            <input
              type="radio"
              name="metodo"
              checked={metodo === "cartao"}
              onChange={() => setMetodo("cartao")}
            />
            Cartão de crédito
          </label>

          {precisaCienciaCdc && (
            <label className={styles.avisoCdc}>
              <input
                type="checkbox"
                checked={cienciaAceita}
                onChange={(e) => setCienciaAceita(e.target.checked)}
              />
              Estou ciente de que, ao reservar um evento com menos de 7 dias de antecedência, solicito a
              execução imediata do serviço; após a realização do evento, o direito de arrependimento (Art. 49
              do CDC) não se aplica.
            </label>
          )}

          {!dadosPix && (
            <button
              type="button"
              className={styles.botaoPrimario}
              onClick={confirmarPagamento}
              disabled={(precisaCienciaCdc && !cienciaAceita) || carregando}
            >
              Confirmar pagamento
            </button>
          )}

          {dadosPix && (
            <div className={styles.blocoPix}>
              <h3>Escaneie o QR Code Pix</h3>
              <img
                src={`data:image/png;base64,${dadosPix.qrCodeBase64}`}
                alt="QR Code Pix para pagamento"
                className={styles.qrCode}
              />
              <p className={styles.copiaCola}>
                <strong>Cópia e cola Pix:</strong>
                <br />
                <code>{dadosPix.qrCode}</code>
              </p>
              {aguardandoPix && (
                <p role="status" className={styles.aguardandoPix}>
                  Aguardando confirmação do pagamento... (não feche esta página)
                </p>
              )}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Escrever o CSS do wizard**

`src/app/reservar-evento/ReservaEventoWizard.module.css`:
```css
.wizard {
  max-width: 560px;
}

.fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

.fieldset legend {
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-bottom: var(--space-md);
  padding: 0;
}

.campo {
  display: block;
  margin-bottom: var(--space-md);
  font-size: 0.85rem;
  color: var(--text-on-paper);
}

.campo input,
.campo select {
  display: block;
  width: 100%;
  margin-top: var(--space-xs);
  padding: 0.6rem 0.7rem;
  background: #fff;
  border: 1px solid var(--paper-border);
  font-family: var(--font-body);
  font-size: 0.95rem;
}

.opcaoPacote {
  display: block;
  margin-bottom: var(--space-sm);
  font-size: 0.9rem;
}

.botaoPrimario {
  background: var(--wine);
  color: var(--paper);
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  letter-spacing: 0.03em;
  cursor: pointer;
  margin-top: var(--space-sm);
}

.botaoPrimario:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mensagemErro {
  border: 1px solid var(--wine);
  color: var(--wine);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
}

.mensagemSucesso {
  border: 1px solid var(--gold-accent);
  padding: var(--space-md);
  max-width: 560px;
}

.valorTotal {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--wine);
}

.avisoCdc {
  display: block;
  font-size: 0.8rem;
  background: rgba(92, 58, 63, 0.08);
  border: 1px solid var(--paper-border);
  padding: var(--space-sm);
  margin: var(--space-sm) 0;
}

.blocoPix {
  margin-top: var(--space-lg);
  border: 1px solid var(--gold-accent);
  padding: var(--space-md);
}

.qrCode {
  width: 200px;
  height: 200px;
  margin: var(--space-sm) 0;
}

.copiaCola {
  word-break: break-all;
  font-size: 0.85rem;
  margin-top: var(--space-sm);
}

.aguardandoPix {
  color: var(--wine);
  font-weight: 500;
}
```

- [ ] **Step 5: Envolver a página com `SiteNav`/`Footer` e o papel creme**

Substitua o conteúdo de `src/app/reservar-evento/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { ReservaEventoWizard } from "./ReservaEventoWizard";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import styles from "./page.module.css";

export default async function ReservarEventoPage() {
  const pacotes = await prisma.pacote.findMany({ orderBy: { nome: "asc" } });

  return (
    <>
      <SiteNav />
      <main className={styles.pagina}>
        <div className="container">
          <h1 className={styles.titulo}>Reservar Evento</h1>
          <ReservaEventoWizard
            pacotes={pacotes.map((p) => ({
              id: p.id,
              nome: p.nome,
              precoPessoa: p.precoPessoa === null ? null : Number(p.precoPessoa),
            }))}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
```

`src/app/reservar-evento/page.module.css`:
```css
.pagina {
  background: var(--paper);
  padding: var(--space-xl) 0;
  min-height: 60vh;
}

.titulo {
  font-size: 1.8rem;
  margin-bottom: var(--space-lg);
  color: var(--text-on-paper);
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- ReservaEventoWizard`
Expected: PASS (1 teste)

- [ ] **Step 7: Rodar a suíte inteira e o typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — nenhuma lógica de negócio mudou (pagamento Pix, polling, CDC, etc. seguem intactos).

- [ ] **Step 8: Commit**

```bash
git add src/app/reservar-evento/
git commit -m "feat: reskin de /reservar-evento com identidade visual e indicador de progresso"
```

---

### Task 10: Verificação final

**Files:** nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Suíte unitária/integração completa**

Run: `npm test`
Expected: PASS em todos os arquivos, incluindo os novos desta feature (`SiteNav`, `Footer`, `DishCard`, `WizardProgress`, `HomePage`, `ReservaMesaWizard`, `ReservaEventoWizard`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 3: E2E existentes continuam passando**

Suba o stack (`docker compose -p fundacao-tecnica up -d --build`) e rode:

Run: `npm run test:e2e`
Expected: PASS em `e2e/reserva-mesa.spec.ts`, `e2e/reserva-evento.spec.ts` e `e2e/admin.spec.ts` — nenhum precisa de asserts alterados, já que texto e estrutura de formulário não mudaram.

Se algum specs falhar por causa de um seletor que dependia da estrutura antiga (ex.: algum `locator` que assumia ausência de wrapper), ajuste o spec E2E para o novo markup, mas **nunca** mude o comportamento do app pra fazer o teste passar.

- [ ] **Step 4: Regressão visual manual**

Suba `npm run dev` (ou use o stack Docker) e visite `/`, `/reservar-mesa` e `/reservar-evento` nas larguras 320px, 768px, 1024px e 1440px (redimensionando a janela do navegador ou via DevTools). Confirme:
- Nenhum overflow horizontal.
- A nav sticky permanece visível e legível ao rolar.
- O indicador de progresso reflete a etapa correta em cada wizard.
- Contraste de texto legível em todas as seções (clima escuro e papel claro).

- [ ] **Step 5: Commit final (se houver ajustes da verificação)**

```bash
git add -A
git commit -m "fix: ajustes finais de verificação do frontend público"
```

(Pule este commit se a Task 10 não exigiu nenhuma mudança de código.)
