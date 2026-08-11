# Mapa 2D de Mesas — Design Spec

## Contexto

O mapa visual de reserva de mesa (`/reservar-mesa`, etapa "Onde") sempre existiu como uma caixa vazia: o sistema de posicionamento por coordenadas (`Mesa.posicaoTour`, JSON com `x`/`y`/`largura`/`altura` em %, consumido por `TableMapProvider`/`FallbackMapProvider`/`loadZonesFromDb`) já está implementado e testado, mas nunca recebeu nem uma imagem de fundo nem coordenadas reais — em nenhum ambiente, nem local nem produção. O seed também só cria 3 mesas de teste (`D01`, `03`, `M01`), muito abaixo do inventário real do restaurante.

Este documento registra o inventário real (levantado com o dono a partir do tour Matterport) e o design do mapa esquemático que vai substituir a caixa vazia.

## Escopo

1. Inventário real de mesas do **Deck** e do **Salão Principal** (o Mezanino já é excluído da reserva diária de mesa — `AMBIENTE_EXCLUIDO_DA_RESERVA_DIARIA` — e fica fora deste documento).
2. Duas imagens de fundo (planta esquemática, não foto) para o mapa: uma por ambiente.
3. Coordenadas reais (`posicaoTour`) para cada mesa, reaproveitando a arquitetura já existente — nenhuma mudança de schema ou de componente é necessária além de popular dados e adicionar a imagem de fundo.

## Inventário — Salão Principal

Fixo, sem variação por dia da semana. 11 mesas:

| Mesa | Formato | Lugares | Zona |
|---|---|---|---|
| 01, 02 | redonda | 4 | Adega (canto, ao lado da porta da cozinha) |
| 03, 04, 05 | oval | 6 | Perto dos quadros (parede com 3 quadros emoldurados) |
| 10 | oval grande | 12 | Entre as duas pilastras, área central |
| 06, 07, 08, 09, 18, 19 | quadrada | 2 | "Bar" — sala lateral com porta de vidro corrediça grande. Posições: 07/06 (fileira 1), 18/08 (fileira 2), 19/09 (fileira 3) |

Landmarks (não são mesas, só referência visual no desenho): porta da cozinha, entrada principal do salão.

## Inventário — Deck (terraço externo)

Dividido em dois lados por um corredor central (escada/entrada). Os números de mesa **mudam de configuração dependendo do dia da semana** — mesmo padrão já existente no código para as mesas duplas do Deck (`diasSemanaAtivos` por registro de `Mesa`, `@@index` em vez de `@@unique` em `[ambienteId, numero]` justamente pra permitir isso).

### Lado esquerdo (posições fixas: topo-esquerda / topo-direita / baixo-esquerda / baixo-direita)

| Dia | Config |
|---|---|
| Terça, quarta, quinta, domingo | **11** (topo-esq), **15** (topo-dir), **12** (baixo-esq), **14** (baixo-dir) — 4 lugares cada |
| Sexta, sábado | **11, 12, 14, 15, 16, 17** — 6 mesas de 2 lugares cada (as mesas "duplas" se separam em unidades menores) |

### Lado direito (posições fixas: topo-esquerda / topo-direita / baixo-esquerda / baixo-direita)

| Dia | Config |
|---|---|
| Terça, quarta, quinta, domingo | **16** (topo-esq), **21** (topo-dir), **17** (baixo-esq), **20** (baixo-dir) — 4 lugares cada |
| Sexta, sábado | **20, 21** (mesmas posições/números, sem mudança) + **22, 23** (nas posições que eram 16 e 17) — 4 mesas de 4 lugares |

**Nota / suposição a confirmar:** não ficou definido qual das posições (16→22 ou 16→23) recebe qual número exato no fim de semana — assumi 16→22 e 17→23 por ordem sequencial. Cosmético, não afeta função; o dono pode corrigir depois de ver o mapa publicado.

**Atenção — número duplicado entre lados, dias diferentes:** "16" e "17" existem tanto do lado esquerdo (sexta/sábado, 2 lugares) quanto do lado direito (terça a domingo, 4 lugares). Nunca colidem porque estão ativos em dias mutuamente exclusivos, mas os dois registros de `Mesa` compartilham o mesmo `numero` — exatamente o cenário que a migração de `@@unique` para `@@index` em `Mesa` já foi feita para suportar.

## Modelo de dados

Cada combinação (número, dias ativos, capacidade) é um registro `Mesa` separado. Isso significa, só pro Deck:

- 11, 12, 14, 15: 2 registros cada (config semana vs. fim de semana) = 8 registros
- 16, 17 (lado esquerdo, só fim de semana): 1 registro cada = 2 registros
- 16, 17 (lado direito, só semana): 1 registro cada = 2 registros
- 20, 21 (lado direito, todos os dias, mesma capacidade): 1 registro cada, `diasSemanaAtivos` = todos os dias = 2 registros
- 22, 23 (lado direito, só fim de semana): 1 registro cada = 2 registros

Total Deck: 16 registros de `Mesa`. Total Salão Principal: 11 registros (sem variação de dia, `diasSemanaAtivos` = todos os dias). **Total geral: 27 registros**, substituindo os 3 de placeholder atuais.

## Design visual

Não é foto do Matterport — é um desenho esquemático (planta baixa) construído a partir das proporções e do agrupamento reais observados no tour, na paleta visual já usada no site (papel creme, contorno vinho, acento dourado). Decisão tomada durante o brainstorming: a ideia inicial era usar screenshot do modo "Floor Plan" do Matterport como imagem de fundo, mas na prática desenhar esquemático ficou mais preciso e muito mais fácil de manter (sem depender de recortar/alinhar fotos).

Duas imagens SVG, uma por ambiente:
- `/public/images/mapa-salao-principal.svg`
- `/public/images/mapa-deck.svg`

O Deck mostra sempre as 4 posições fixas (topo-esq/topo-dir/baixo-esq/baixo-dir por lado); qual número/capacidade aparece em cada botão vem do `posicaoTour` do registro de `Mesa` que estiver ativo pro dia selecionado — o filtro por `mesasDisponiveis` que já existe no `ReservaMesaWizard` cuida disso automaticamente, sem lógica nova de dia da semana no componente visual.

## Fora de escopo

- Mezanino: não tem mesas fixas reserváveis (ver plano `2026-08-04-reserva-mesa-diaria.md`), não entra neste levantamento.
- Ajuste fino de posição pixel-a-pixel: o desenho é esquemático/aproximado, suficiente pro cliente se situar ("minha mesa é perto da janela" / "perto da adega"), não um mapa arquitetônico exato.
- Se o resultado visual não agradar, o dono já sinalizou que podemos refazer com ferramentas de imagem por IA depois — não é bloqueante pra este lote.

## Critérios de aceitação

- As 27 mesas reais (11 Salão + 16 Deck, contando os registros duplicados por dia) existem no banco com número, capacidade e `diasSemanaAtivos` corretos conforme as tabelas acima.
- O mapa do Salão Principal mostra um desenho esquemático com as 11 mesas posicionadas nos agrupamentos corretos (adega, quadros, entre pilastras, bar).
- O mapa do Deck mostra as 4 posições fixas por lado, com o número/capacidade correto trocando automaticamente conforme o dia selecionado no wizard.
- Nenhuma mudança de schema Prisma é necessária (o campo `posicaoTour` e o índice não-único em `[ambienteId, numero]` já existem).
