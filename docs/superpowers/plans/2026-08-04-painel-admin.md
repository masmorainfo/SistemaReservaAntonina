# Painel Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o painel operacional que a equipe usa no dia a dia — login, mapa do dia (mesas + eventos), cancelamento manual de reserva de mesa, lista de eventos com edição do percentual de sinal negociado por telefone, e edição da tabela de política de cancelamento — respeitando os dois perfis (Dono/Recepção) definidos na Fundação.

**Architecture:** Rotas sob `/admin/*` protegidas por middleware do Auth.js; cada Route Handler administrativo valida sessão e permissão via um helper único (`exigirSessaoAdmin`) que reaproveita `verificarPermissao` da Fundação. Páginas são Client Components que buscam dados via `fetch` nas próprias rotas admin, seguindo o mesmo padrão dos planos anteriores.

**Tech Stack:** Next.js Route Handlers + Middleware · Auth.js (sessão JWT) · Prisma · React · Vitest + Testing Library · Playwright (E2E)

## Pré-requisitos

Este plano assume que os três planos anteriores (`fundacao-tecnica`, `reserva-mesa-diaria`, `reserva-evento-mezanino`) já foram executados e verificados.

## Débito técnico registrado (fora do escopo deste plano, mas rastreado)

**Autorização nas rotas públicas de reserva de evento** (`POST /api/eventos/reservas/[id]/cancelar`, `PUT /api/eventos/reservas/[id]/pratos`, `POST /api/eventos/reservas/[id]/pagamento`, do plano `reserva-evento-mezanino`): nenhuma dessas rotas verifica se quem chama é de fato o cliente dono da reserva — o id (cuid) da reserva é a única "chave", o que é obscuridade, não autorização real. Decisão registrada na revisão final daquele plano: aceitar o risco por ora (rotas voltadas ao cliente final, não ao admin — fora do escopo de `exigirSessaoAdmin` deste plano) e desenhar a solução (token por e-mail/SMS enviado ao cliente, ou outro mecanismo de posse) como parte de um trabalho futuro dedicado, não como extensão ad-hoc da autenticação de admin construída aqui.

## Escopo desta fase (o que fica de fora, e por quê)

Cadastro de mesas/ambientes/pacotes e gestão de usuários da equipe **não** ganham telas dedicadas neste plano — são operações raras (configuração inicial do restaurante, não uso diário), e o **Prisma Studio** (`npm run db:studio`, já disponível desde a Fundação) já entrega CRUD completo nessas tabelas sem esforço adicional de implementação. Se o volume de uso um dia justificar telas próprias, isso vira uma tarefa de Fase 2. Da mesma forma, a troca do provedor de pagamento ativo não ganha UI aqui — não faz sentido construir um seletor quando `MockProvider` é o único provedor que existe na Fase 1 (ver plano de Fundação); isso é trabalho de Fase 2, quando um provedor real for conectado.

## Global Constraints

Herda todas as constraints dos planos anteriores. Adicionalmente:
- Toda rota sob `/api/admin/*` **deve** chamar `exigirSessaoAdmin(papeisPermitidos)` como primeira coisa, antes de qualquer outra lógica — nenhuma exceção, mesmo em rotas que "só leem dados".
- Testes de rota administrativa mockam `@/lib/auth` (`vi.mock`) em vez de simular uma sessão HTTP real — mais rápido e mais direto para testar as três combinações (sem sessão, Recepção, Dono) por rota.

## Visão geral dos arquivos

```
src/
  middleware.ts                                    (novo)
  lib/
    auth/
      requireSession.ts                            (novo)
    domain/
      dailyOverview.ts                              (novo)
  app/
    admin/
      layout.tsx                                    (novo)
      login/page.tsx                                (novo)
      mapa-do-dia/page.tsx                           (novo)
      eventos/page.tsx                               (novo)
      politica-cancelamento/page.tsx                 (novo)
    api/
      admin/
        mapa-do-dia/route.ts                         (novo)
        reservas-mesa/[id]/cancelar/route.ts         (novo)
        eventos/
          route.ts                                   (novo)
          [id]/sinal/route.ts                         (novo)
        politica-cancelamento/route.ts                (novo)
e2e/
  admin.spec.ts                                      (novo)
```

---

### Task 1: Autenticação — middleware, layout e página de login

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `auth` (Fundação, `src/lib/auth.ts`).
- Produces: proteção automática de qualquer rota sob `/admin/*`; formulário de login funcional.

- [ ] **Step 1: Criar o middleware de proteção**

`src/middleware.ts`:
```ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/admin/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Criar o layout admin com SessionProvider**

`src/app/admin/layout.tsx`:
```tsx
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return <SessionProvider session={session}>{children}</SessionProvider>;
}
```

**Por que buscar a sessão no servidor e passar pro `SessionProvider`:** evita o "flash" de conteúdo não autenticado — sem isso, `useSession()` nas páginas filhas começaria em estado `loading` mesmo com o usuário já autenticado, gerando um piscar de tela desnecessário.

- [ ] **Step 3: Criar a página de login**

`src/app/admin/login/page.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resultado = await signIn("credentials", { email, senha, redirect: false });
      if (resultado?.error) {
        setErro("e-mail ou senha inválidos");
        return;
      }
      router.push("/admin/mapa-do-dia");
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main>
      <h1>Entrar</h1>
      <form onSubmit={handleSubmit}>
        {erro && <p role="alert">{erro}</p>}
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <button type="submit" disabled={carregando}>
          Entrar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Verificação manual**

Run: `docker compose up -d --build`
Acesse `http://localhost:3000/admin/mapa-do-dia` sem estar logado — deve redirecionar para `/admin/login`. Faça login com `dono@antoninaosteria.com` / `trocar-esta-senha` (usuário criado pelo seed da Fundação) e confirme que o redirecionamento funciona.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/app/admin/layout.tsx src/app/admin/login/
git commit -m "feat: middleware de autenticação, layout e login do painel admin"
```

---

### Task 2: Helper de sessão e permissão para rotas admin

**Files:**
- Create: `src/lib/auth/requireSession.ts`
- Test: `src/lib/auth/requireSession.test.ts`

**Interfaces:**
- Consumes: `auth` (Fundação), `verificarPermissao`, `AcessoNegadoError`, tipo `AdminRole` (Fundação, `src/lib/auth/roles.ts`).
- Produces: `exigirSessaoAdmin(papeisPermitidos)`, `NaoAutenticadoError` — usados por toda rota `/api/admin/*` das próximas tasks.

- [ ] **Step 0: Corrigir um bug real da Fundação antes de depender dele**

O callback de sessão do Auth.js escrito na Fundação (`src/lib/auth.ts`) só copia `role` para `session.user` — nunca `id`. Isso não quebra nenhum teste da Fundação (nenhum deles lê `session.user.id`), mas quebraria silenciosamente todo o painel admin em produção, porque `exigirSessaoAdmin` (implementado abaixo) precisa do `id` do usuário. Testes mockados desta task não pegam esse tipo de bug — eles mockam a sessão inteira, então "funcionam" mesmo se a Fundação nunca preenchesse `id` de verdade. Corrija agora, antes de construir em cima disso.

Modifique `src/lib/auth.ts` (substitua o bloco `callbacks`):
```ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string }).role = token.role as string;
        (session.user as { role?: string; id?: string }).id = token.id as string;
      }
      return session;
    },
  },
```

Run: `npm test` (roda a suíte inteira, incluindo os testes de autenticação da Fundação) para confirmar que nada quebrou com essa mudança.

```bash
git add src/lib/auth.ts
git commit -m "fix: preenche session.user.id no callback do Auth.js"
```

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/auth/requireSession.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { exigirSessaoAdmin, NaoAutenticadoError } from "./requireSession";
import { AcessoNegadoError } from "./roles";

describe("exigirSessaoAdmin", () => {
  it("lança NaoAutenticadoError quando não há sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    await expect(exigirSessaoAdmin(["DONO"])).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança AcessoNegadoError quando o perfil não está entre os permitidos", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    await expect(exigirSessaoAdmin(["DONO"])).rejects.toThrow(AcessoNegadoError);
  });

  it("retorna os dados da sessão quando o perfil é permitido", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "DONO" } } as never);
    const resultado = await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
    expect(resultado).toEqual({ userId: "u1", role: "DONO" });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- requireSession`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/auth/requireSession.ts`:
```ts
import { auth } from "@/lib/auth";
import { verificarPermissao, type AdminRole } from "./roles";

export class NaoAutenticadoError extends Error {
  constructor() {
    super("sessão não autenticada");
    this.name = "NaoAutenticadoError";
  }
}

export async function exigirSessaoAdmin(
  papeisPermitidos: AdminRole[]
): Promise<{ userId: string; role: AdminRole }> {
  const session = await auth();

  if (!session?.user) {
    throw new NaoAutenticadoError();
  }

  const usuario = session.user as { id?: string; role?: AdminRole };
  if (!usuario.role || !usuario.id) {
    throw new NaoAutenticadoError();
  }

  verificarPermissao(usuario.role, papeisPermitidos);

  return { userId: usuario.id, role: usuario.role };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- requireSession`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/requireSession.ts src/lib/auth/requireSession.test.ts
git commit -m "feat: helper de sessão e permissão para rotas administrativas"
```

---

### Task 3: Domain — agregação do mapa do dia

**Files:**
- Create: `src/lib/domain/dailyOverview.ts`
- Test: `src/lib/domain/dailyOverview.test.ts`

**Interfaces:**
- Produces: `buscarMapaDoDia(data)`, tipos `ReservaMesaResumo`, `ReservaEventoResumo`.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/domain/dailyOverview.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { buscarMapaDoDia } from "./dailyOverview";

describe("buscarMapaDoDia", () => {
  let ambienteId: string;
  let mesaId: string;
  let pacoteId: string;
  const data = new Date(2027, 6, 1);

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Mapa" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({ data: { ambienteId, numero: "M01", capacidadeLugares: 4 } });
    mesaId = mesa.id;

    await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Visível",
        telefone: "+5541999999999",
        data,
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });

    await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Cancelado",
        telefone: "+5541999999998",
        data,
        horarioChegada: "19:30",
        numPessoas: 2,
        status: "CANCELADA",
      },
    });

    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Mapa", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    await prisma.reservaEvento.create({
      data: {
        clienteNome: "Empresa Visível",
        clienteTelefone: "+5541999999997",
        clienteEmail: "visivel@exemplo.com",
        tipoEvento: "CORPORATIVO",
        data,
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        status: "CONFIRMADA",
      },
    });
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  it("retorna as reservas de mesa e evento não canceladas do dia", async () => {
    const resultado = await buscarMapaDoDia(data);

    expect(resultado.mesas).toHaveLength(1);
    expect(resultado.mesas[0].nomeCliente).toBe("Cliente Visível");
    expect(resultado.mesas[0].ambienteNome).toBe("Ambiente Teste Mapa");

    expect(resultado.eventos).toHaveLength(1);
    expect(resultado.eventos[0].clienteNome).toBe("Empresa Visível");
    expect(resultado.eventos[0].pacoteNome).toBe("Pacote Teste Mapa");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- dailyOverview`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/lib/domain/dailyOverview.ts`:
```ts
import { prisma } from "@/lib/db";

export interface ReservaMesaResumo {
  id: string;
  mesaNumero: string;
  ambienteNome: string;
  nomeCliente: string;
  telefone: string;
  horarioChegada: string;
  numPessoas: number;
  status: string;
}

export interface ReservaEventoResumo {
  id: string;
  clienteNome: string;
  tipoEvento: string;
  numConvidados: number;
  valorTotal: number;
  percentualSinal: number;
  status: string;
  pacoteNome: string | null;
}

export async function buscarMapaDoDia(
  data: Date
): Promise<{ mesas: ReservaMesaResumo[]; eventos: ReservaEventoResumo[] }> {
  const reservasMesa = await prisma.reservaMesa.findMany({
    where: { data, status: { not: "CANCELADA" } },
    include: { mesa: { include: { ambiente: true } } },
    orderBy: { horarioChegada: "asc" },
  });

  const reservasEvento = await prisma.reservaEvento.findMany({
    where: { data, status: { not: "CANCELADA" } },
    include: { pacote: true },
  });

  return {
    mesas: reservasMesa.map((r) => ({
      id: r.id,
      mesaNumero: r.mesa.numero,
      ambienteNome: r.mesa.ambiente.nome,
      nomeCliente: r.nomeCliente,
      telefone: r.telefone,
      horarioChegada: r.horarioChegada,
      numPessoas: r.numPessoas,
      status: r.status,
    })),
    eventos: reservasEvento.map((r) => ({
      id: r.id,
      clienteNome: r.clienteNome,
      tipoEvento: r.tipoEvento,
      numConvidados: r.numConvidados,
      valorTotal: Number(r.valorTotal),
      percentualSinal: Number(r.percentualSinal),
      status: r.status,
      pacoteNome: r.pacote?.nome ?? null,
    })),
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- dailyOverview`
Expected: PASS (1 teste)

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/dailyOverview.ts src/lib/domain/dailyOverview.test.ts
git commit -m "feat: agregação do mapa do dia (mesas e eventos)"
```

---

### Task 4: API — mapa do dia e cancelamento manual de mesa

**Files:**
- Create: `src/app/api/admin/mapa-do-dia/route.ts`
- Create: `src/app/api/admin/reservas-mesa/[id]/cancelar/route.ts`
- Test: `src/app/api/admin/mapa-do-dia/route.test.ts`
- Test: `src/app/api/admin/reservas-mesa/[id]/cancelar/route.test.ts`

**Interfaces:**
- Consumes: `exigirSessaoAdmin` (Task 2), `buscarMapaDoDia` (Task 3).
- Produces: `GET /api/admin/mapa-do-dia?data=` (Dono + Recepção); `POST /api/admin/reservas-mesa/[id]/cancelar` (Dono + Recepção).

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/admin/mapa-do-dia/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

describe("GET /api/admin/mapa-do-dia", () => {
  it("retorna 401 sem sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/admin/mapa-do-dia?data=2027-07-01");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("retorna 400 sem o parâmetro data, mesmo autenticado", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/mapa-do-dia");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna 200 com mesas e eventos para Recepção autenticada", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/mapa-do-dia?data=2027-07-01");
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toHaveProperty("mesas");
    expect(body).toHaveProperty("eventos");
  });
});
```

`src/app/api/admin/reservas-mesa/[id]/cancelar/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { POST } from "./route";

describe("POST /api/admin/reservas-mesa/[id]/cancelar", () => {
  let ambienteId: string;
  let mesaId: string;
  let reservaId: string;

  beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Teste Admin Cancelar" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({ data: { ambienteId, numero: "A01", capacidadeLugares: 4 } });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  beforeEach(async () => {
    const reserva = await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Teste",
        telefone: "+5541999999999",
        data: new Date(2027, 5, 1),
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });
    reservaId = reserva.id;
  });

  it("retorna 401 quando não há sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const request = new NextRequest(`http://localhost/api/admin/reservas-mesa/${reservaId}/cancelar`, {
      method: "POST",
    });
    const response = await POST(request, { params: { id: reservaId } });
    expect(response.status).toBe(401);
  });

  it("cancela a reserva quando autenticado como Recepção", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest(`http://localhost/api/admin/reservas-mesa/${reservaId}/cancelar`, {
      method: "POST",
    });
    const response = await POST(request, { params: { id: reservaId } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reserva.status).toBe("CANCELADA");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- admin/mapa-do-dia admin/reservas-mesa`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar**

`src/app/api/admin/mapa-do-dia/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { buscarMapaDoDia } from "@/lib/domain/dailyOverview";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const dataParam = request.nextUrl.searchParams.get("data");
  if (!dataParam) {
    return NextResponse.json({ erro: "parâmetro 'data' é obrigatório" }, { status: 400 });
  }

  const data = new Date(`${dataParam}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ erro: "parâmetro 'data' inválido" }, { status: 400 });
  }

  const mapa = await buscarMapaDoDia(data);
  return NextResponse.json(mapa);
}
```

`src/app/api/admin/reservas-mesa/[id]/cancelar/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const reserva = await prisma.reservaMesa.findUnique({ where: { id: params.id } });
  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  const atualizada = await prisma.reservaMesa.update({
    where: { id: params.id },
    data: { status: "CANCELADA" },
  });

  return NextResponse.json({ reserva: atualizada });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- admin/mapa-do-dia admin/reservas-mesa`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/mapa-do-dia/ src/app/api/admin/reservas-mesa/
git commit -m "feat: rotas admin de mapa do dia e cancelamento manual de mesa"
```

---

### Task 5: API — lista de eventos e edição do percentual de sinal

**Files:**
- Create: `src/app/api/admin/eventos/route.ts`
- Create: `src/app/api/admin/eventos/[id]/sinal/route.ts`
- Test: `src/app/api/admin/eventos/route.test.ts`
- Test: `src/app/api/admin/eventos/[id]/sinal/route.test.ts`

**Interfaces:**
- Consumes: `exigirSessaoAdmin` (Task 2).
- Produces: `GET /api/admin/eventos`; `PATCH /api/admin/eventos/[id]/sinal` (ambos Dono + Recepção, conforme a tabela de permissões da spec).

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/admin/eventos/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

describe("GET /api/admin/eventos", () => {
  it("retorna 401 sem sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/admin/eventos");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("retorna 200 com a lista de eventos para Recepção autenticada", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/eventos");
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.eventos)).toBe(true);
  });
});
```

`src/app/api/admin/eventos/[id]/sinal/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { PATCH } from "./route";

describe("PATCH /api/admin/eventos/[id]/sinal", () => {
  let pacoteId: string;
  let reservaId: string;

  beforeAll(async () => {
    const pacote = await prisma.pacote.create({
      data: { nome: "Pacote Teste Sinal", precoPessoa: 200, taxaServicoPct: 10 },
    });
    pacoteId = pacote.id;

    const reserva = await prisma.reservaEvento.create({
      data: {
        clienteNome: "Cliente Negociado",
        clienteTelefone: "+5541999999999",
        clienteEmail: "negociado@exemplo.com",
        tipoEvento: "CORPORATIVO",
        data: new Date(2027, 8, 1),
        numConvidados: 10,
        pacoteId,
        valorTotal: 2200,
        percentualSinal: 100,
        status: "AGUARDANDO_PAGAMENTO",
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    reservaId = reserva.id;
  });

  afterAll(async () => {
    await prisma.reservaEvento.deleteMany({ where: { pacoteId } });
    await prisma.pacote.delete({ where: { id: pacoteId } });
  });

  it("retorna 401 sem sessão", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const request = new NextRequest(`http://localhost/api/admin/eventos/${reservaId}/sinal`, {
      method: "PATCH",
      body: JSON.stringify({ percentualSinal: 50 }),
    });
    const response = await PATCH(request, { params: { id: reservaId } });
    expect(response.status).toBe(401);
  });

  it("atualiza o percentual de sinal quando autenticado como Recepção", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest(`http://localhost/api/admin/eventos/${reservaId}/sinal`, {
      method: "PATCH",
      body: JSON.stringify({ percentualSinal: 50 }),
    });
    const response = await PATCH(request, { params: { id: reservaId } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reserva.percentualSinal).toBe("50");
  });

  it("retorna 400 para percentual fora do intervalo válido", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest(`http://localhost/api/admin/eventos/${reservaId}/sinal`, {
      method: "PATCH",
      body: JSON.stringify({ percentualSinal: 150 }),
    });
    const response = await PATCH(request, { params: { id: reservaId } });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- admin/eventos`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar**

`src/app/api/admin/eventos/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

export async function GET() {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const eventos = await prisma.reservaEvento.findMany({
    where: { status: { not: "CANCELADA" } },
    include: { pacote: true, pagamento: true },
    orderBy: { data: "asc" },
  });

  return NextResponse.json({ eventos });
}
```

`src/app/api/admin/eventos/[id]/sinal/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

interface SinalInput {
  percentualSinal: number;
}

function validarInput(body: unknown): body is SinalInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.percentualSinal === "number" && b.percentualSinal > 0 && b.percentualSinal <= 100;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const body = await request.json();
  if (!validarInput(body)) {
    return NextResponse.json({ erro: "percentualSinal deve ser um número entre 0 e 100" }, { status: 400 });
  }

  const reserva = await prisma.reservaEvento.findUnique({ where: { id: params.id } });
  if (!reserva) {
    return NextResponse.json({ erro: "reserva não encontrada" }, { status: 404 });
  }

  if (reserva.status !== "AGUARDANDO_PAGAMENTO") {
    return NextResponse.json(
      { erro: "só é possível editar o sinal antes do pagamento ser confirmado" },
      { status: 409 }
    );
  }

  const atualizada = await prisma.reservaEvento.update({
    where: { id: params.id },
    data: { percentualSinal: body.percentualSinal },
  });

  return NextResponse.json({ reserva: atualizada });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- admin/eventos`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/eventos/
git commit -m "feat: rotas admin de lista de eventos e edição de percentual de sinal"
```

---

### Task 6: API — edição da política de cancelamento (Dono only)

**Files:**
- Create: `src/app/api/admin/politica-cancelamento/route.ts`
- Test: `src/app/api/admin/politica-cancelamento/route.test.ts`

**Interfaces:**
- Consumes: `exigirSessaoAdmin` (Task 2).
- Produces: `GET /api/admin/politica-cancelamento` (Dono + Recepção); `PUT /api/admin/politica-cancelamento` (**Dono only**, substitui a tabela inteira).

- [ ] **Step 1: Escrever os testes que falham**

`src/app/api/admin/politica-cancelamento/route.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { GET, PUT } from "./route";

describe("GET /api/admin/politica-cancelamento", () => {
  it("retorna 200 para Recepção autenticada", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento");
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});

describe("PUT /api/admin/politica-cancelamento", () => {
  afterEach(async () => {
    await prisma.politicaCancelamento.deleteMany({ where: { diasMinimos: 9999 } });
  });

  it("retorna 403 quando quem tenta editar é Recepção", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "RECEPCAO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento", {
      method: "PUT",
      body: JSON.stringify([{ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 10 }]),
    });
    const response = await PUT(request);
    expect(response.status).toBe(403);
  });

  it("substitui a tabela quando autenticado como Dono", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1", role: "DONO" } } as never);
    const request = new NextRequest("http://localhost/api/admin/politica-cancelamento", {
      method: "PUT",
      body: JSON.stringify([{ diasMinimos: 9999, diasMaximos: null, percentualReembolso: 10 }]),
    });
    const response = await PUT(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tiersCriados).toBe(1);

    const tiers = await prisma.politicaCancelamento.findMany();
    expect(tiers).toHaveLength(1);
    expect(tiers[0].diasMinimos).toBe(9999);
  });
});
```

**Atenção ao rodar este teste:** o segundo `it` de `PUT` apaga e recria **toda** a tabela `PoliticaCancelamento`, inclusive os tiers do seed da Fundação — é intencional para testar a rota isoladamente. **Importante:** desde o fix da Fundação Técnica que protege a política de cancelamento configurada pelo admin, `prisma/seed.ts` só popula `PoliticaCancelamento` quando a tabela está vazia (`count === 0`) — rodar `npm run db:seed` de novo depois deste teste **não** restaura os tiers padrão, porque a tabela não está mais vazia (ficou com o tier de teste `diasMinimos: 9999`). Para voltar aos tiers padrão antes de continuar usando o ambiente manualmente, apague a tabela primeiro e só então rode o seed: `npx prisma db execute --stdin <<< 'DELETE FROM "PoliticaCancelamento";'` seguido de `npm run db:seed`.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- admin/politica-cancelamento`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`src/app/api/admin/politica-cancelamento/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirSessaoAdmin, NaoAutenticadoError } from "@/lib/auth/requireSession";
import { AcessoNegadoError } from "@/lib/auth/roles";

interface TierInput {
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: number;
}

function validarTiers(body: unknown): body is TierInput[] {
  if (!Array.isArray(body) || body.length === 0) return false;
  return body.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    return (
      typeof t.diasMinimos === "number" &&
      (t.diasMaximos === null || typeof t.diasMaximos === "number") &&
      typeof t.percentualReembolso === "number"
    );
  });
}

export async function GET(request: NextRequest) {
  try {
    await exigirSessaoAdmin(["DONO", "RECEPCAO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const tiers = await prisma.politicaCancelamento.findMany({ orderBy: { diasMinimos: "desc" } });
  return NextResponse.json({ tiers });
}

export async function PUT(request: NextRequest) {
  try {
    await exigirSessaoAdmin(["DONO"]);
  } catch (erro) {
    if (erro instanceof NaoAutenticadoError) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    if (erro instanceof AcessoNegadoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const body = await request.json();
  if (!validarTiers(body)) {
    return NextResponse.json({ erro: "lista de faixas de cancelamento inválida" }, { status: 400 });
  }

  const resultado = await prisma.$transaction([
    prisma.politicaCancelamento.deleteMany(),
    prisma.politicaCancelamento.createMany({ data: body }),
  ]);

  return NextResponse.json({ tiersCriados: resultado[1].count });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- admin/politica-cancelamento`
Expected: PASS (3 testes)

- [ ] **Step 5: Restaurar a política padrão apagada pelo teste**

Run: `npm run db:seed`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/politica-cancelamento/
git commit -m "feat: rota admin de edição da política de cancelamento (Dono only)"
```

---

### Task 7: UI — mapa do dia

**Files:**
- Create: `src/app/admin/mapa-do-dia/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/mapa-do-dia`, `POST /api/admin/reservas-mesa/[id]/cancelar` (Task 4).

- [ ] **Step 1: Implementar a página**

`src/app/admin/mapa-do-dia/page.tsx`:
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface ReservaMesaResumo {
  id: string;
  mesaNumero: string;
  ambienteNome: string;
  nomeCliente: string;
  telefone: string;
  horarioChegada: string;
  numPessoas: number;
  status: string;
}

interface ReservaEventoResumo {
  id: string;
  clienteNome: string;
  tipoEvento: string;
  numConvidados: number;
  valorTotal: number;
  percentualSinal: number;
  status: string;
  pacoteNome: string | null;
}

export default function MapaDoDiaPage() {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [mesas, setMesas] = useState<ReservaMesaResumo[]>([]);
  const [eventos, setEventos] = useState<ReservaEventoResumo[]>([]);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    const resposta = await fetch(`/api/admin/mapa-do-dia?data=${data}`);
    const corpo = await resposta.json();
    if (!resposta.ok) {
      setErro(corpo.erro ?? "não foi possível carregar o mapa do dia");
      return;
    }
    setMesas(corpo.mesas);
    setEventos(corpo.eventos);
  }, [data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function cancelarReservaMesa(id: string) {
    const resposta = await fetch(`/api/admin/reservas-mesa/${id}/cancelar`, { method: "POST" });
    if (resposta.ok) {
      await carregar();
    }
  }

  return (
    <main>
      <h1>Mapa do Dia</h1>
      <label>
        Data
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </label>

      {erro && <p role="alert">{erro}</p>}

      <h2>Mesas</h2>
      <ul>
        {mesas.map((reserva) => (
          <li key={reserva.id}>
            {reserva.ambienteNome} — Mesa {reserva.mesaNumero} — {reserva.nomeCliente} ({reserva.telefone}) —{" "}
            {reserva.numPessoas} pessoas às {reserva.horarioChegada} — {reserva.status}
            {reserva.status === "CONFIRMADA" && (
              <button type="button" onClick={() => cancelarReservaMesa(reserva.id)}>
                Cancelar
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2>Eventos</h2>
      <ul>
        {eventos.map((evento) => (
          <li key={evento.id}>
            {evento.clienteNome} — {evento.tipoEvento} — {evento.numConvidados} convidados —{" "}
            {evento.pacoteNome ?? "Cardápio Aberto"} — R$ {evento.valorTotal.toFixed(2)} — {evento.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Verificação manual**

Run: `docker compose up -d --build`
Faça login em `/admin/login` e acesse `/admin/mapa-do-dia`. Crie uma reserva de mesa pelo fluxo público (`/reservar-mesa`) para hoje, confirme que ela aparece aqui, e teste o botão "Cancelar".

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/mapa-do-dia/
git commit -m "feat: página do mapa do dia no painel admin"
```

---

### Task 8: UI — eventos e política de cancelamento

**Files:**
- Create: `src/app/admin/eventos/page.tsx`
- Create: `src/app/admin/politica-cancelamento/page.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/admin/eventos*` (Task 5), `GET/PUT /api/admin/politica-cancelamento` (Task 6), `useSession` (next-auth/react) para esconder a edição de política de quem não é Dono.

- [ ] **Step 1: Implementar a página de eventos**

`src/app/admin/eventos/page.tsx`:
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface EventoAdmin {
  id: string;
  clienteNome: string;
  data: string;
  numConvidados: number;
  valorTotal: string;
  percentualSinal: string;
  status: string;
}

export default function EventosAdminPage() {
  const [eventos, setEventos] = useState<EventoAdmin[]>([]);
  const [erro, setErro] = useState("");
  const [novoSinal, setNovoSinal] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setErro("");
    const resposta = await fetch("/api/admin/eventos");
    const corpo = await resposta.json();
    if (!resposta.ok) {
      setErro(corpo.erro ?? "não foi possível carregar os eventos");
      return;
    }
    setEventos(corpo.eventos);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarSinal(id: string) {
    const valor = Number(novoSinal[id]);
    if (!valor || valor <= 0 || valor > 100) {
      setErro("percentual de sinal inválido");
      return;
    }

    const resposta = await fetch(`/api/admin/eventos/${id}/sinal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentualSinal: valor }),
    });

    const corpo = await resposta.json();
    if (!resposta.ok) {
      setErro(corpo.erro ?? "não foi possível atualizar o sinal");
      return;
    }

    await carregar();
  }

  return (
    <main>
      <h1>Eventos</h1>
      {erro && <p role="alert">{erro}</p>}
      <ul>
        {eventos.map((evento) => (
          <li key={evento.id}>
            {evento.clienteNome} — {evento.data} — {evento.numConvidados} convidados — R$ {evento.valorTotal}{" "}
            — sinal atual: {evento.percentualSinal}% — {evento.status}
            {evento.status === "AGUARDANDO_PAGAMENTO" && (
              <>
                <label>
                  Novo percentual de sinal
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={novoSinal[evento.id] ?? ""}
                    onChange={(e) => setNovoSinal({ ...novoSinal, [evento.id]: e.target.value })}
                  />
                </label>
                <button type="button" onClick={() => salvarSinal(evento.id)}>
                  Salvar sinal
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Implementar a página de política de cancelamento**

`src/app/admin/politica-cancelamento/page.tsx`:
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Tier {
  id: string;
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: string;
}

export default function PoliticaCancelamentoPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    const resposta = await fetch("/api/admin/politica-cancelamento");
    const corpo = await resposta.json();
    if (!resposta.ok) {
      setErro(corpo.erro ?? "não foi possível carregar a política");
      return;
    }
    setTiers(corpo.tiers);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function atualizarTier(index: number, campo: keyof Tier, valor: string) {
    const copia = [...tiers];
    copia[index] = { ...copia[index], [campo]: valor } as Tier;
    setTiers(copia);
  }

  async function salvar() {
    setErro("");
    setSucesso("");
    const payload = tiers.map((t) => ({
      diasMinimos: Number(t.diasMinimos),
      diasMaximos: t.diasMaximos === null ? null : Number(t.diasMaximos),
      percentualReembolso: Number(t.percentualReembolso),
    }));

    const resposta = await fetch("/api/admin/politica-cancelamento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const corpo = await resposta.json();
    if (!resposta.ok) {
      setErro(corpo.erro ?? "não foi possível salvar a política");
      return;
    }

    setSucesso("Política atualizada com sucesso");
    await carregar();
  }

  return (
    <main>
      <h1>Política de Cancelamento</h1>
      {erro && <p role="alert">{erro}</p>}
      {sucesso && <p role="status">{sucesso}</p>}
      <table>
        <thead>
          <tr>
            <th>Dias mínimos</th>
            <th>Dias máximos</th>
            <th>% de reembolso</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, index) => (
            <tr key={tier.id}>
              <td>
                <input
                  type="number"
                  value={tier.diasMinimos}
                  disabled={role !== "DONO"}
                  onChange={(e) => atualizarTier(index, "diasMinimos", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={tier.diasMaximos ?? ""}
                  disabled={role !== "DONO"}
                  onChange={(e) => atualizarTier(index, "diasMaximos", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={tier.percentualReembolso}
                  disabled={role !== "DONO"}
                  onChange={(e) => atualizarTier(index, "percentualReembolso", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === "DONO" && (
        <button type="button" onClick={salvar}>
          Salvar política
        </button>
      )}
    </main>
  );
}
```

**Por que esconder o botão de salvar no front-end não é suficiente sozinho:** um usuário Recepção nunca vê o botão, mas mesmo que alguém forjasse a requisição `PUT` diretamente, a rota (Task 6) já rejeita com `403` — a UI só evita a tentativa, quem garante a regra é a API.

- [ ] **Step 3: Verificação manual**

Run: `docker compose up -d --build`
Faça login como Dono, edite um percentual da política e salve — confirme a mensagem de sucesso. Depois crie um usuário Recepção via Prisma Studio (`npm run db:studio`, tabela `AdminUser`, campo `role = RECEPCAO`, senha gerada com `hashSenha` — pode usar um script Node rápido chamando a função para gerar o hash), faça login com ele e confirme que os campos aparecem desabilitados e sem botão de salvar.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/eventos/ src/app/admin/politica-cancelamento/
git commit -m "feat: páginas admin de eventos e política de cancelamento"
```

---

### Task 9: E2E — login e cancelamento de mesa pelo admin

**Files:**
- Create: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: página `/admin/login` e `/admin/mapa-do-dia` (Tasks 1, 7), usuário `dono@antoninaosteria.com` do seed da Fundação.

- [ ] **Step 1: Escrever o teste E2E**

`e2e/admin.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/db";

test.describe("Painel administrativo", () => {
  let ambienteId: string;
  let mesaId: string;

  test.beforeAll(async () => {
    const ambiente = await prisma.ambiente.create({ data: { nome: "Ambiente Admin E2E" } });
    ambienteId = ambiente.id;
    const mesa = await prisma.mesa.create({ data: { ambienteId, numero: "AD01", capacidadeLugares: 4 } });
    mesaId = mesa.id;

    await prisma.reservaMesa.create({
      data: {
        mesaId,
        nomeCliente: "Cliente Admin E2E",
        telefone: "+5541999997777",
        data: new Date(2027, 5, 1),
        horarioChegada: "19:00",
        numPessoas: 2,
        status: "CONFIRMADA",
      },
    });
  });

  test.afterAll(async () => {
    await prisma.reservaMesa.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { ambienteId } });
    await prisma.ambiente.delete({ where: { id: ambienteId } });
  });

  test("dono faz login e cancela uma reserva de mesa pelo mapa do dia", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill("dono@antoninaosteria.com");
    await page.getByLabel("Senha").fill("trocar-esta-senha");
    await page.getByText("Entrar").click();

    await page.goto("/admin/mapa-do-dia");
    await page.getByLabel("Data").fill("2027-06-01");

    await expect(page.getByText("Cliente Admin E2E")).toBeVisible();
    await page.getByText("Cancelar").click();

    await expect(page.getByText("Cliente Admin E2E")).not.toBeVisible();
  });
});
```

**Pré-requisito para este teste passar:** o seed da Fundação precisa ter sido rodado (`npm run db:seed`) para o usuário `dono@antoninaosteria.com` existir com a senha `trocar-esta-senha`. Se a Task 6 deste plano foi executada antes (que apaga e recria `PoliticaCancelamento`), isso não afeta o `AdminUser` — são tabelas independentes.

- [ ] **Step 2: Rodar o E2E com o stack completo no ar**

Run: `docker compose up -d --build`
Run: `npx prisma migrate dev`
Run: `npm run db:seed`
Run: `npm run test:e2e`
Expected: 3 testes passando (mesa diária, evento, admin).

- [ ] **Step 3: Commit**

```bash
git add e2e/admin.spec.ts
git commit -m "test: E2E de login e cancelamento manual de mesa pelo admin"
```

---

## Checklist final do plano

- [ ] `npm test` passa 100% (todos os quatro planos)
- [ ] `npm run test:e2e` passa com os três fluxos (mesa, evento, admin)
- [ ] Acessar `/admin/mapa-do-dia` sem login redireciona para `/admin/login`
- [ ] Usuário Recepção consegue cancelar mesa, ver eventos e editar sinal, mas não consegue salvar a política de cancelamento (campos desabilitados na UI e `403` se forçar a chamada da API)
- [ ] Usuário Dono consegue tudo o que Recepção consegue, mais editar e salvar a política de cancelamento
- [ ] A tabela `PoliticaCancelamento` está com os tiers padrão, não os de teste, antes de considerar o ambiente pronto para demonstração — como o seed só popula a tabela quando ela está vazia (ver nota na Task correspondente acima), rodar `npm run db:seed` sozinho **não** limpa um tier de teste deixado por engano; se necessário, apague a tabela antes (`npx prisma db execute --stdin <<< 'DELETE FROM "PoliticaCancelamento";'`) e então rode o seed

Com os quatro planos da Fase 1 completos (Fundação, Reserva de Mesa Diária, Reserva de Evento, Painel Admin), o sistema tem um núcleo funcional de ponta a ponta: cliente reserva mesa ou evento, paga (mock), e a equipe opera tudo pelo painel. A Fase 2 (WhatsApp real, gateway de pagamento real, Mattertags reais) entra como evolução sobre essa base, sem precisar reabrir nenhuma decisão de arquitetura — é só trocar as implementações por trás dos adaptadores já definidos na Fundação.
