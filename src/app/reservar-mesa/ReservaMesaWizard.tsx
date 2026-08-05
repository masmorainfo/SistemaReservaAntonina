"use client";

import { useState } from "react";
import type { ZonaClicavel } from "@/providers/tableMap/TableMapProvider";
import type { MesaDisponivel } from "@/types/reservaMesa";

interface Ambiente {
  id: string;
  nome: string;
}

interface ReservaMesaWizardProps {
  ambientes: Ambiente[];
  zonasPorAmbiente: Record<string, ZonaClicavel[]>;
}

type Etapa = "quando" | "onde" | "dados" | "confirmado";

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
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "confirmado") {
    const mesa = mesasDisponiveis.find((m) => m.id === mesaSelecionadaId);
    return (
      <p role="status">
        Reserva confirmada para {nomeCliente} — mesa {mesa?.numero}, {data} às {horarioChegada}.
      </p>
    );
  }

  return (
    <div>
      {erro && <p role="alert">{erro}</p>}

      {etapa === "quando" && (
        <fieldset>
          <legend>Quando você quer vir?</legend>
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <button type="button" onClick={buscarHorarios} disabled={!data || carregando}>
            Ver horários
          </button>

          {horarios.length > 0 && (
            <>
              <label>
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
              <label>
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
        <fieldset>
          <legend>Onde você quer sentar?</legend>
          <div role="tablist">
            {ambientes.map((ambiente) => (
              <button
                key={ambiente.id}
                type="button"
                role="tab"
                aria-selected={ambiente.id === ambienteSelecionadoId}
                onClick={() => trocarAmbiente(ambiente.id)}
              >
                {ambiente.nome}
              </button>
            ))}
          </div>

          <div
            aria-label={`Mapa do ambiente ${ambientes.find((a) => a.id === ambienteSelecionadoId)?.nome ?? ""}`}
            style={{ position: "relative" }}
          >
            {zonasPorAmbiente[ambienteSelecionadoId]
              ?.filter((zona) => mesasDisponiveis.some((mesa) => mesa.id === zona.mesaId))
              .map((zona) => (
                <button
                  key={zona.mesaId}
                  type="button"
                  style={{
                    position: "absolute",
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
          <ul>
            {mesasDisponiveis.map((mesa) => (
              <li key={mesa.id}>
                <button
                  type="button"
                  aria-pressed={mesa.id === mesaSelecionadaId}
                  onClick={() => setMesaSelecionadaId(mesa.id)}
                >
                  Mesa {mesa.numero} — {mesa.capacidadeLugares} lugares
                  {mesa.faixa === "alternativa" ? " (maior que o ideal para o grupo)" : ""}
                </button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={() => setEtapa("dados")} disabled={!mesaSelecionadaId}>
            Continuar
          </button>
        </fieldset>
      )}

      {etapa === "dados" && (
        <fieldset>
          <legend>Seus dados</legend>
          <label>
            Nome
            <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
          </label>
          <label>
            Telefone
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <button
            type="button"
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
