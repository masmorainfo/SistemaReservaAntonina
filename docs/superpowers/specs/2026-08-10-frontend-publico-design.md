# Frontend Público — Identidade Visual e Redesign — Design Spec

## Contexto

O sistema de reservas do Antonina Osteria está funcionalmente completo (reserva de mesa, reserva de evento com pagamento Pix real via Mercado Pago, painel admin), mas o frontend público nunca recebeu identidade visual: zero arquivos CSS no projeto inteiro, HTML semântico sem estilo, e a home (`src/app/page.tsx`) é um placeholder (`<main>Antonina Osteria</main>`).

O Antonina Osteria já tem marca real e estabelecida — Instagram verificado (@antoninaosteria, 26,6 mil seguidores), tour Matterport da fachada e área externa, cardápio publicado (cardapio.pedyun.com.br/antoninaosteria). Este projeto usa essa identidade existente como base, em vez de criar uma do zero.

**Objetivo**: desenhar e implementar a identidade visual do site público — home nova + reskin das duas telas de reserva já funcionais (`/reservar-mesa`, `/reservar-evento`). O painel admin (`/admin/*`) fica fora deste projeto.

## Pesquisa de marca (fontes)

- Instagram: https://www.instagram.com/antoninaosteria/ — bio, paleta dos ícones de destaque, fotos do feed.
- Tour Matterport: https://my.matterport.com/show/?m=noadeK6Syis — fachada, arquitetura, materiais.
- Cardápio publicado: https://cardapio.pedyun.com.br/antoninaosteria — logo oficial, cor de marca, pratos e preços reais.

Achados: osteria tartuferia (especializada em trufa) upscale, em Uberlândia-MG. Cor de marca é um vinho/mauve acinzentado (aparece no logo, nos ícones do Instagram e nas cadeiras da área externa — não é coincidência). Fachada em pedra/estuque creme, ferro trabalhado preto, iluminação quente. Ambiente elegante, um pouco romântico, arquitetônico — não rústico/casual.

## 1. Identidade visual (tokens)

### Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg-dark` | `#1c1a1d` | Hero, nav, rodapé, seções de clima da home |
| `--bg-dark-elevated` | `#2c2226` | Cards/superfícies sobre fundo escuro |
| `--text-cream` | `#e8ded1` | Texto sobre fundo escuro |
| `--gold-accent` | `#c9a24a` | Detalhes pontuais: linhas finas, rótulos, hover, ícones. Nunca como cor de fundo grande. |
| `--wine` | `#5c3a3f` | Cor secundária da marca (logo, cadeiras). Botões primários e destaques em fundo claro. |
| `--paper` | `#f4efe9` | Fundo dos formulários de reserva |
| `--paper-border` | `#d8c9bd` | Bordas de input sobre o papel |

Contraste a validar na implementação: `--text-cream` sobre `--bg-dark` (deve passar WCAG AA facilmente — ambos já calibrados para isso), `--wine` sobre `--paper` para texto/botões.

### Tipografia

- **Fraunces** (display/títulos) — peso 500–600 para a maior parte, itálico reservado para citações/assinatura visual.
- **Work Sans** (corpo de texto) — peso 300–400.
- Carregadas via `next/font/google` (self-hosted pelo Next, sem FOUT).

### Motivos recorrentes

- Linhas finas douradas como separador (referência ao ferro trabalhado da fachada).
- Cantos retos, não arredondados — reforça o caráter clássico/arquitetônico.
- Espaço negativo generoso; densidade baixa de elementos por seção.

## 2. Home (`/`)

### Navegação (sticky, fundo `--bg-dark`)

- Logo/monograma à esquerda.
- Links: `Cardápio` (abre https://cardapio.pedyun.com.br/antoninaosteria em nova aba), `Eventos` (âncora pra seção de eventos da própria home), `Contato` (âncora pro rodapé).
- Botão duplo fixo à direita — **Mesa** / **Evento** como dois segmentos, sempre visível, cada um levando direto pra `/reservar-mesa` ou `/reservar-evento`. Resolve a ambiguidade de "reservar o quê" sem etapa extra.

### Seções, em ordem

1. **Hero** — foto full-bleed da fachada ao anoitecer, overlay escuro pra legibilidade, "ANTONINA OSTERIA", tagline ("1ª Osteria Tartuferia de Uberlândia"), horário resumido.
2. **Sobre / Tartuferia** — parágrafo curto (2-3 frases) contando a proposta: trufa, autoral, o espaço.
3. **Destaques do cardápio** — 4 cards (`DishCard`, componente reusado): Arancini, Burrata al Pesto, Cacio e Pepe, Banoffee Antonina — foto, nome, preço, descrição curta (dados reais extraídos do cardápio publicado). Botão "Ver cardápio completo" → link externo.
4. **Galeria do espaço** — grade de 4-6 fotos (fachada, terraço, salão, mezanino) + link "Ver tour virtual 3D" apontando pro Matterport existente.
5. **Mezanino / Eventos** — seção dedicada vendendo o espaço de eventos privados, com CTA "Reservar Evento".
6. **Localização, horário e CTA final** — endereço, horário, mapa, link do Instagram, CTA dupla (Mesa/Evento) de novo.
7. **Rodapé** (fundo `--bg-dark`) — logo, navegação repetida, redes sociais.

A home é essencialmente estática — Server Component, sem `"use client"`. O único comportamento client-side é `position: sticky` em CSS puro na nav (sem JavaScript).

## 3. Reskin de `/reservar-mesa` e `/reservar-evento`

- **Nenhuma mudança de comportamento.** Fetch calls, `useState`, validações, chamadas de API — tudo intocado. Só a casca visual muda.
- Ambos os wizards passam a renderizar dentro do novo shell: `SiteNav` + `Footer` (fundo escuro) por fora, conteúdo do formulário em si sobre fundo `--paper` (decisão consciente: formulário fica mais legível e confortável de preencher que sobre fundo escuro — a "sala" muda, a marca continua visível na moldura).
- `<fieldset>`/`<legend>`/`<label>` (já semânticos) ganham estilo com os tokens acima.
- **Indicador de progresso** (novo, puramente visual): breadcrumb no topo do wizard mostrando as etapas (ex.: `Quando → Onde → Dados` para mesa; `Quando → Pacote → Checkout` para evento), destacando a etapa atual. Não altera o estado interno do componente — deriva da variável `etapa` que já existe.
- Botão primário: fundo `--wine`, texto creme.
- Tela do QR Code Pix (`ReservaEventoWizard`, etapa de checkout): mesmo tratamento papel-creme, QR emoldurado, código copia-e-cola numa caixa com borda fina dourada.
- Estados de erro (`role="alert"`) e sucesso (`role="status"`) mantêm as mesmas roles ARIA — só ganham estilo (alerta com borda vinho, sucesso com borda dourada).

## 4. Abordagem técnica

- **CSS puro com custom properties** — sem Tailwind, sem Radix, sem biblioteca de componentes. Mantém o padrão que o projeto já segue.
- `src/styles/tokens.css` — as custom properties da seção 1, importado uma vez em `src/app/layout.tsx`.
- **CSS Modules** por página/componente (`page.module.css`, `ReservaMesaWizard.module.css`, `ReservaEventoWizard.module.css`, etc.) — escopo automático, zero-config no Next.js.
- **Componentes novos** (só o que se repete de verdade):
  - `SiteNav` — nav pública sticky, Server Component.
  - `Footer` — rodapé, Server Component.
  - `DishCard` — usado 4x nos destaques do cardápio.
  - `WizardProgress` — indicador de progresso, usado nos dois wizards.
- **Fontes**: `next/font/google` (Fraunces, Work Sans).
- **Imagens**: `next/image` (responsivo, lazy-load abaixo da dobra, `width`/`height` explícitos). Arquivos reais em `public/images/`.

## 5. Conteúdo e imagens

- **Copy**: rascunho real (não placeholder) para tagline, texto "sobre" e textos de seção, escrito a partir do que já é público (bio do Instagram, cardápio). O dono revisa e ajusta livremente depois — não bloqueia a implementação.
- **Imagens**: ~10-12 fotos selecionadas do feed público do Instagram (fachada, terraço, salão, os 4 pratos dos destaques, Mezanino), baixadas para `public/images/` durante a implementação. Uso autorizado pelo dono do restaurante (conta oficial da própria marca).
- **Tour 3D**: link direto para o Matterport existente na seção de galeria — não substitui nem altera a lógica de seleção de mesa (`FallbackMapProvider`/mapa 2D continua como está).

## 6. Fora de escopo

- Visual do painel admin (`/admin/*`) — projeto separado.
- Cardápio embutido no site — decidido: link externo para o cardápio já publicado.
- Substituir o mapa 2D de seleção de mesa por Matterport real.
- Qualquer feature nova de produto (newsletter, blog, conta de cliente, etc.).
- Revisão jurídica, WhatsApp Business real, contrato Matterport para admin — pendências de negócio já registradas em outros documentos, não afetadas por este projeto.

## 7. Testes e verificação

- **E2E existentes** (`e2e/reserva-mesa.spec.ts`, `e2e/reserva-evento.spec.ts`) devem continuar passando sem alteração de asserts — o reskin não muda texto nem estrutura de formulário, só aparência. Rodar a suíte completa (`npm run test:e2e`) ao final da implementação para confirmar; ajustar seletores só se algo quebrar por causa da nova estrutura de wrapper/nav.
- **Regressão visual**: capturar screenshots da home e dos dois wizards nas larguras 320, 768, 1024 e 1440px.
- **Acessibilidade**: manter contraste WCAG AA nas combinações de cor definidas, navegação por teclado na nav sticky e no indicador de progresso, `prefers-reduced-motion` respeitado em qualquer transição.
- **Nenhum teste unitário/integração existente muda** — a lógica de domínio e as rotas de API não são tocadas por este projeto.

## Critérios de aceitação

- Home (`/`) deixa de ser um placeholder e reflete a identidade visual desta spec, com as 7 seções descritas.
- `/reservar-mesa` e `/reservar-evento` mantêm 100% do comportamento atual (testado pelos specs E2E existentes), com a nova casca visual e o indicador de progresso.
- Nenhuma dependência de UI framework nova foi adicionada (`package.json` não ganha Tailwind/Radix/etc.).
- Suíte de testes unitários/integração (`npm test`) e E2E (`npm run test:e2e`) passam sem alteração de comportamento.
- Paleta, tipografia e tokens desta spec são usados de forma consistente nas três páginas (nenhuma cor/fonte fora do sistema definido).
