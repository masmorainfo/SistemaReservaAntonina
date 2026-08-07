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
    try {
      const resposta = await fetch("/api/admin/eventos");
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível carregar os eventos");
        return;
      }
      setEventos(corpo.eventos);
    } catch {
      setErro("não foi possível carregar os eventos");
    }
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

    try {
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
    } catch {
      setErro("não foi possível atualizar o sinal");
    }
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
