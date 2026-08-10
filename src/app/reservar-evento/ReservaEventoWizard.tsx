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
