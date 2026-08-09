"use client";

import { useEffect, useState } from "react";
import type { DadosPix } from "@/providers/payment/PaymentProvider";

interface Pacote {
  id: string;
  nome: string;
  precoPessoa: number | null;
}

interface ReservaEventoWizardProps {
  pacotes: Pacote[];
}

type TipoEvento = "CORPORATIVO" | "ANIVERSARIO" | "JANTAR_RESERVADO" | "OUTRO";
type Etapa =
  | "quando"
  | "pacote"
  | "orcamento"
  | "orcamentoEnviado"
  | "checkout"
  | "aguardandoPix"
  | "pagamentoExpirado"
  | "confirmado";

const VALOR_TELAO_PROJETOR = 500;

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
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [dadosPix, setDadosPix] = useState<DadosPix | null>(null);
  const [codigoPixCopiado, setCodigoPixCopiado] = useState(false);

  async function copiarCodigoPix() {
    if (!dadosPix) return;
    try {
      await navigator.clipboard.writeText(dadosPix.qrCode);
      setCodigoPixCopiado(true);
      setTimeout(() => setCodigoPixCopiado(false), 3000);
    } catch {
      // Clipboard indisponível (ex.: navegador sem permissão) — o código
      // continua selecionável manualmente na textarea, então não é um erro
      // que impeça o pagamento.
    }
  }

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
        setEtapa("aguardandoPix");
        return;
      }

      setEtapa("confirmado");
    } catch {
      setErro("não foi possível conectar ao servidor para confirmar o pagamento");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (etapa !== "aguardandoPix" || !dadosPix) {
      return;
    }

    const expiraEmMs = new Date(dadosPix.expiraEm).getTime();

    const intervalo = setInterval(async () => {
      if (Date.now() >= expiraEmMs) {
        clearInterval(intervalo);
        setEtapa("pagamentoExpirado");
        return;
      }

      try {
        const resposta = await fetch(`/api/eventos/reservas/${reservaId}`);
        if (!resposta.ok) {
          return;
        }
        const corpo = await resposta.json();

        if (corpo.status === "CONFIRMADA") {
          clearInterval(intervalo);
          setEtapa("confirmado");
        } else if (corpo.status === "CANCELADA") {
          clearInterval(intervalo);
          setEtapa("pagamentoExpirado");
        }
      } catch {
        // Falha pontual de rede durante o polling — tenta de novo no
        // próximo intervalo, sem interromper a espera.
      }
    }, 3000);

    return () => clearInterval(intervalo);
  }, [etapa, dadosPix, reservaId]);

  if (etapa === "orcamentoEnviado") {
    return <p role="status">Pedido de orçamento enviado! Nossa equipe entrará em contato em breve.</p>;
  }

  if (etapa === "confirmado") {
    return (
      <p role="status">
        Evento confirmado para {clienteNome} em {data}. Em breve você recebe o link para escolher os pratos do
        cardápio.
      </p>
    );
  }

  if (etapa === "pagamentoExpirado") {
    return (
      <p role="alert">
        O tempo para concluir o pagamento esgotou. Volte e comece a reserva novamente.
      </p>
    );
  }

  return (
    <div>
      {erro && <p role="alert">{erro}</p>}

      {etapa === "quando" && (
        <fieldset>
          <legend>Sobre o seu evento</legend>
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Tipo de evento
            <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value as TipoEvento)}>
              <option value="CORPORATIVO">Corporativo</option>
              <option value="ANIVERSARIO">Aniversário</option>
              <option value="JANTAR_RESERVADO">Jantar reservado</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            Número de convidados (até 40)
            <input
              type="number"
              min={1}
              max={40}
              value={numConvidados}
              onChange={(e) => setNumConvidados(Number(e.target.value))}
            />
          </label>
          <label>
            Nome
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          </label>
          <label>
            Telefone
            <input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} />
          </label>
          <label>
            E-mail
            <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
          </label>
          <button
            type="button"
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
        <fieldset>
          <legend>Escolha o pacote</legend>
          {pacotes.map((pacote) => (
            <label key={pacote.id}>
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
          <label>
            <input
              type="checkbox"
              checked={equipamentoTelao}
              onChange={(e) => setEquipamentoTelao(e.target.checked)}
            />
            Telão &amp; Projetor (+R$ 500,00)
          </label>
          <button type="button" onClick={escolherPacote} disabled={!pacoteId || carregando}>
            {cardapioAberto ? "Solicitar orçamento" : "Continuar para pagamento"}
          </button>
        </fieldset>
      )}

      {etapa === "orcamento" && (
        <fieldset>
          <legend>Pedido de orçamento — Cardápio Aberto</legend>
          <p>Sua data, tipo de evento e número de convidados já foram registrados. Confirme o envio:</p>
          <button type="button" onClick={enviarPedidoOrcamento} disabled={carregando}>
            Enviar pedido de orçamento
          </button>
        </fieldset>
      )}

      {etapa === "checkout" && (
        <fieldset>
          <legend>Pagamento</legend>
          <p>Valor total: R$ {valorTotal.toFixed(2)}</p>
          <label>
            <input type="radio" name="metodo" checked={metodo === "pix"} onChange={() => setMetodo("pix")} />
            Pix
          </label>
          <label>
            <input
              type="radio"
              name="metodo"
              checked={metodo === "cartao"}
              onChange={() => setMetodo("cartao")}
            />
            Cartão de crédito
          </label>

          {precisaCienciaCdc && (
            <label>
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

          <button
            type="button"
            onClick={confirmarPagamento}
            disabled={(precisaCienciaCdc && !cienciaAceita) || carregando}
          >
            Confirmar pagamento
          </button>
        </fieldset>
      )}

      {etapa === "aguardandoPix" && dadosPix && (
        <fieldset>
          <legend>Pague com Pix</legend>
          <p>Escaneie o QR code no app do seu banco ou copie o código abaixo.</p>
          <img
            src={`data:image/png;base64,${dadosPix.qrCodeBase64}`}
            alt="QR code para pagamento Pix"
            width={200}
            height={200}
          />
          <label>
            Código copia-e-cola
            <textarea readOnly value={dadosPix.qrCode} />
          </label>
          <button type="button" onClick={copiarCodigoPix}>
            {codigoPixCopiado ? "Copiado!" : "Copiar código"}
          </button>
          <p role="status">Aguardando confirmação do pagamento...</p>
        </fieldset>
      )}
    </div>
  );
}
