"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReservaMesaResumo, ReservaEventoResumo } from "@/lib/domain/dailyOverview";

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
