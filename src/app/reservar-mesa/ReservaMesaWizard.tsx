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

const IMAGEM_MAPA_POR_AMBIENTE: Record<string, string> = {
  Deck: "/images/mapa-deck.svg",
  "Salão Principal": "/images/mapa-salao-principal.svg",
};

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

  const ambienteSelecionado = ambientes.find((a) => a.id === ambienteSelecionadoId);
  const imagemMapa = ambienteSelecionado
    ? IMAGEM_MAPA_POR_AMBIENTE[ambienteSelecionado.nome]
    : undefined;

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
            aria-label={`Mapa do ambiente ${ambienteSelecionado?.nome ?? ""}`}
            className={styles.mapa}
            style={imagemMapa ? { backgroundImage: `url(${imagemMapa})` } : undefined}
          >
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
          </div>

          <p>Lista de mesas (alternativa acessível ao mapa):</p>
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
