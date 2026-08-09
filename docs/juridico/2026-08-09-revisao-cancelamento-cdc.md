# Revisão jurídica pendente — Política de Cancelamento e Art. 49 do CDC

**Status:** pendente desde a definição do escopo do projeto (registrado em
`docs/superpowers/specs/2026-08-03-sistema-reservas-eventos-design.md`, seção "Pendências para
fechar antes ou durante a implementação", item 1). **O sistema já está em produção com a tabela e
o texto abaixo, sem essa revisão ter sido feita.**

Este documento reúne exatamente o que precisa ser revisado por um advogado, para facilitar o
envio. Não é uma peça jurídica — é um levantamento técnico do que está implementado hoje.

## Contexto do produto

A Antonina Osteria vende, pelo site, reservas de eventos fechados no mezanino (aniversário,
corporativo, jantar reservado — pacotes de R$197 a R$297 por pessoa) com **checkout 100%
automático**: o cliente escolhe a data, paga um sinal (padrão 100% do valor, mas pode ser
negociado por telefone para um percentual menor) via Pix, e a reserva é confirmada
automaticamente. Isso caracteriza uma compra online sujeita ao Art. 49 do Código de Defesa do
Consumidor (direito de arrependimento em 7 dias para compras fora do estabelecimento comercial).

## 1. Tabela de política de cancelamento (valores em produção hoje)

Fonte: `src/lib/domain/refundPolicy.ts` (tabela padrão), configurável pelo Dono no painel admin
sem necessidade de novo deploy — ou seja, **se o advogado recomendar valores diferentes, dá para
aplicar a mudança diretamente no admin, sem depender de mim ou de um novo lançamento**.

| Cancelamento com... | Reembolso |
|---|---|
| 15 dias ou mais de antecedência | 100% |
| 8 a 14 dias | 75% |
| 4 a 7 dias | 50% |
| 2 a 3 dias | 25% |
| Menos de 48h (ou no-show) | 0% |

O percentual de reembolso é aplicado sobre **o valor efetivamente pago** (o sinal, que pode ser
menor que 100% do valor do evento quando negociado por telefone), não sobre o valor total do
evento.

## 2. Texto de ciência sobre o Art. 49, mostrado no checkout (texto exato em produção)

Fonte: `src/app/reservar-evento/ReservaEventoWizard.tsx`. Aparece como uma caixa de marcação
(checkbox) obrigatória — **o cliente não consegue prosseguir com o pagamento sem marcá-la** —
apenas quando a reserva é feita com **menos de 7 dias de antecedência** do evento:

> "Estou ciente de que, ao reservar um evento com menos de 7 dias de antecedência, solicito a
> execução imediata do serviço; após a realização do evento, o direito de arrependimento (Art. 49
> do CDC) não se aplica."

## 3. Como isso é aplicado tecnicamente

- O limite de 7 dias e a exigência da marcação são **validados no servidor**, não só na tela — um
  cliente não consegue burlar a exigência manipulando o site (`src/app/api/eventos/reservas/[id]/pagamento/route.ts`,
  constante `DIAS_LIMITE_DIREITO_ARREPENDIMENTO = 7`).
- A confirmação da marcação (`cienciaDireitoArrependimento: true/false`) fica registrada no banco
  de dados, associada à reserva, com timestamp de criação — serve como registro de que o cliente
  de fato marcou a caixa antes de pagar.
- Reservas com 7 dias ou mais de antecedência **não** exigem essa marcação (a lógica atual
  assume que o direito de arrependimento se aplica normalmente nesses casos, sem tratamento
  especial).

## Perguntas específicas para o advogado

1. A tabela de reembolso proporcional (seção 1) é juridicamente defensável como estrutura, dado
   que o Art. 49 garante reembolso **integral** em até 7 dias corridos da contratação (não do
   evento)? A lógica atual conta os dias **até o evento**, não os dias desde a contratação — isso
   é uma diferença material que precisa de validação.
2. O texto de ciência (seção 2) é suficiente para caracterizar a exceção de "execução imediata a
   pedido expresso do consumidor" (art. 49, §único, e correlatos do Decreto 7.962/2013 sobre
   e-commerce)? Falta alguma informação obrigatória (preço final, prazo de execução, direito de
   reclamação)?
3. O corte de 7 dias usado para exigir a ciência está correto, ou deveria ser diferente (ex.:
   contado da contratação, não do evento, como mencionado no item 1)?
4. Existe exigência de que esse texto apareça em outro momento do fluxo além do checkout (ex.:
   e-mail de confirmação, termos de uso gerais do site)?
5. A tabela e o texto, uma vez aprovados, podem ser adotados como estão, ou precisam de ajuste de
   redação/valores antes de seguir em produção?

## Depois da revisão

Assim que a resposta chegar:
- Se só os **valores da tabela** mudarem, aplico direto no painel admin (Dono → Política de
  Cancelamento) — sem precisar de mim.
- Se o **texto de ciência** ou a **lógica de contagem de dias** mudarem, isso exige uma alteração
  de código — me chama que eu implemento.
