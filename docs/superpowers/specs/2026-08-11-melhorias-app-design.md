# Melhorias do App — Lote 1 (correções e UX) — Design Spec

## Contexto

O dono do Antonina Osteria trouxe um documento de requisitos ("ANTONINA OSTERIA — REQUISITOS DE MELHORIA DO APP") com 5 seções. Depois de uma análise técnica item a item, este projeto cobre só os itens que fazem sentido implementar como estão, sem depender de decisão de negócio/custo/jurídico adicional. O restante fica registrado como fora de escopo, com o motivo, para retomar em outra conversa.

## Escopo

1. Corrigir o link do cardápio e remover preços da home (itens 1.1, 1.2 do documento original).
2. Calendário de disponibilidade de evento mostrando datas já ocupadas antes do cliente preencher tudo (item 3.1).
3. Modal de confirmação ao adicionar o add-on de Telão & Projetor no pacote de evento (item 5.1).
4. Mostrar mesas ocupadas (acinzentadas, não clicáveis) no mapa de reserva de mesa, além das disponíveis (item 4.1 ajustado).

## Fora de escopo (ver conversa anterior para os motivos completos)

- **2.1–2.4 (verificação de e-mail/SMS/2FA/fingerprint)**: 2.3 (2FA com Authenticator) não se aplica — o sistema não tem conta de cliente, não há o que proteger com segundo fator. 2.1/2.2/2.4 são decisões de custo (SMS pago), fricção de conversão e LGPD que precisam de conversa de negócio antes de virar código.
- **2.5 e 5.2 (sanitização e proteção contra manipulação de preço/múltiplos pacotes)**: já garantidos pela arquitetura atual (Prisma com queries parametrizadas, React escapa output por padrão, preço de evento já calculado 100% no servidor, `pacoteId` já é uma FK única — um evento nunca tem mais de um pacote). Vale uma auditoria futura, não é trabalho de implementação.
- **3.2 (horários fixos com sinal pago de R$150 no slot das 20h)**: muda o modelo de negócio da reserva de mesa diária (hoje é 100% gratuita, sem pagamento) e teria a mesma pendência jurídica (Art. 49 CDC) já registrada para eventos. Tamanho de projeto próprio, não cabe num lote de correções.
- **4.2 (tour 3D só depois da reserva confirmada)**: conflita com o uso atual do tour como ferramenta de marketing pré-reserva, já embutido na home. Precisa decidir se quer os dois usos (vitrine pública + visualização pós-reserva) antes de mexer.

## 1. Link do cardápio e preços na home

- `CARDAPIO_URL` está duplicado em `SiteNav.tsx`, `Footer.tsx` e `page.tsx`. Extrair para `src/lib/constants.ts`, com o valor corrigido: `https://www.vucafood.com.br/antoninaosteria/3522/cardapio-digital`. Os três arquivos passam a importar dali.
- `DishCard` deixa de receber e renderizar a prop `preco` — usado só na home hoje, sem impacto em outro lugar.

## 2. Calendário de disponibilidade de evento

**Novo componente** `EventAvailabilityCalendar` (Client Component, `src/components/EventAvailabilityCalendar.tsx`):
- Props controladas: `{ value: string; onChange: (data: string) => void }` (data em formato `YYYY-MM-DD`, mesmo contrato do `<input type="date">` que substitui).
- Grade de mês com cabeçalho de dias da semana, navegação mês anterior/próximo (anterior desabilitado se o mês exibido já é o mês atual — não dá pra reservar no passado).
- Estado de cada dia: **passado** (desabilitado, sem interação), **ocupado** (desabilitado, visualmente diferenciado — acinzentado/riscado), **disponível** (clicável), **selecionado** (destacado, corresponde a `value`).
- Ao montar e ao trocar de mês, busca as datas ocupadas daquele mês.
- Acessível: cada dia é um `<button>` com `aria-label` descritivo do estado ("15 de setembro, indisponível"), navegação por teclado funciona naturalmente por serem botões em sequência.

**Nova rota** `GET /api/eventos/disponibilidade-mes?ano=YYYY&mes=M` (mês 1–12):
- Reaproveita `liberarHoldsExpirados()` de `src/lib/domain/eventHolds.ts` antes de consultar, igual à rota de disponibilidade por data única já existente.
- Consulta `ReservaEvento` com `status` em `CONFIRMADA` ou `AGUARDANDO_PAGAMENTO` (hold ainda válido) dentro do intervalo do mês pedido.
- Retorna `{ datasOcupadas: ["YYYY-MM-DD", ...] }`.

**Integração**: `ReservaEventoWizard.tsx`, etapa "quando" — troca o `<input type="date">` por `<EventAvailabilityCalendar value={data} onChange={setData} />`. Nenhuma outra lógica da etapa muda (verificação de disponibilidade no clique de "Verificar disponibilidade" continua existindo como dupla checagem server-side, já que o calendário reflete o estado no momento em que foi carregado, não em tempo real).

## 3. Modal de confirmação de add-on

**Novo componente** `AddonConfirmModal` (Client Component, `src/components/AddonConfirmModal.tsx`), usando o elemento nativo `<dialog>` do HTML — sem biblioteca, o navegador cuida de foco preso, fechar com Esc e clique fora:
- Props: `{ open: boolean; pacoteNome: string; valorBase: number; valorAddon: number; onConfirm: () => void; onCancel: () => void }`.
- `useEffect` chama `dialogRef.current.showModal()` quando `open` vira `true`, e `.close()` quando vira `false`.
- Conteúdo: nome do pacote + valor base, "Telão & Projetor" + valor do add-on, total (soma), botões Confirmar e Cancelar.
- O evento nativo `cancel` do `<dialog>` (disparado pelo Esc) também chama `onCancel` — mantém consistência entre os três jeitos de fechar (Cancelar, Esc, clique fora).

**Integração**: `ReservaEventoWizard.tsx`, etapa "pacote". Hoje o checkbox de `equipamentoTelao` atualiza o estado direto no `onChange`. Passa a: ao **marcar** (não ao desmarcar), abrir o modal em vez de mudar o estado imediatamente; `onConfirm` seta `equipamentoTelao = true`; `onCancel` mantém o checkbox desmarcado (estado nunca mudou). Desmarcar continua instantâneo, sem confirmação — não faz sentido confirmar a remoção de um custo.

## 4. Mesas ocupadas no mapa de reserva

Hoje `GET /api/mesas-disponiveis` **exclui** mesas já reservadas da resposta — elas simplesmente não aparecem. Para mostrá-las acinzentadas, a rota precisa passar a incluí-las com um status.

**Cuidado importante**: mesas duplas do Deck têm dois registros de `Mesa` diferentes, cada um ativo em dias da semana diferentes (`diasSemanaAtivos`). O registro que **não está ativo no dia escolhido** não deve aparecer como "ocupada" — ele simplesmente não existe fisicamente configurado para aquele dia. Do mesmo jeito, uma mesa pequena demais pro grupo continua não aparecendo (comportamento atual, mantido). Só entra como "ocupada" quem: (a) está ativa naquele dia da semana, (b) tem capacidade suficiente pro grupo, e (c) já tem uma `ReservaMesa` com status `CONFIRMADA` naquela data.

- `src/lib/domain/tableAvailability.ts` / `tableFit.ts`: em vez de excluir as mesas reservadas do resultado, retorná-las com `faixa: "ocupada"` (estende o union type existente `"ideal" | "alternativa"` → `"ideal" | "alternativa" | "ocupada"`). A lógica de "só mostra alternativa se não tiver nenhuma ideal" continua igual, e se aplica só entre `ideal`/`alternativa` — mesas `ocupada` sempre aparecem, independente desse toggle.
- `ReservaMesaWizard.tsx`, etapa "onde": remove o filtro atual que descarta do mapa qualquer zona cujo `mesaId` não esteja em `mesasDisponiveis` — passa a renderizar todas as zonas presentes na resposta (que agora inclui as ocupadas). Botões com `faixa === "ocupada"` recebem `disabled` (não `aria-pressed`, já que não são selecionáveis) e estilo acinzentado; o mesmo vale na lista textual alternativa.
- **Regra de negócio que não pode quebrar**: uma mesa com `faixa === "ocupada"` nunca pode virar `mesaSelecionadaId` — o botão fica de fato desabilitado, não é só estilo.

## Testes e verificação

- Novos componentes (`EventAvailabilityCalendar`, `AddonConfirmModal`) ganham testes de comportamento (React Testing Library) cobrindo os estados descritos acima.
- Nova rota `disponibilidade-mes` ganha teste de integração seguindo o padrão das rotas existentes (banco real de teste, purga de holds expirados coberta).
- Mudança em `tableAvailability.ts`/`tableFit.ts` exige atualizar os testes existentes desses arquivos e de `mesas-disponiveis/route.test.ts` para cobrir o novo status `"ocupada"`, incluindo o caso do Deck (mesa dupla ativa só num dos dois conjuntos de dias).
- `ReservaMesaWizard.tsx`: teste garantindo que uma mesa `ocupada` não pode ser selecionada mesmo simulando o clique.
- E2E existentes (`e2e/reserva-mesa.spec.ts`, `e2e/reserva-evento.spec.ts`) precisam continuar passando — como este lote muda comportamento de verdade (diferente do reskin visual anterior), é esperado que alguns specs precisem de ajuste de asserts; a lógica de negócio em si (regras de horário, cálculo de preço, hold de 15 min, CDC) não muda.

## Critérios de aceitação

- Link do cardápio na home, nav e rodapé aponta para a URL correta em todos os 3 lugares.
- Nenhum preço aparece nos cards de destaque do cardápio na home.
- O calendário de evento mostra visualmente as datas já ocupadas antes do cliente preencher qualquer outro campo, e não permite selecioná-las.
- Marcar "Telão & Projetor" sempre abre o modal de confirmação antes de aplicar o custo; desmarcar não abre nada.
- O mapa de reserva de mesa mostra mesas ocupadas acinzentadas e não-clicáveis, sem nunca permitir selecioná-las, e sem mostrar como "ocupada" uma mesa que não está fisicamente configurada pra aquele dia da semana.
