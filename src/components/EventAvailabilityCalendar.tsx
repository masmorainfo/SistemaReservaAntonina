"use client";

import { useEffect, useState } from "react";
import { construirGradeDoMes, NOMES_MESES, type EstadoDia } from "@/lib/domain/eventCalendarGrid";
import styles from "./EventAvailabilityCalendar.module.css";

interface EventAvailabilityCalendarProps {
  value: string;
  onChange: (data: string) => void;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseAnoMes(valor: string, hoje: Date): { ano: number; mes: number } {
  if (!valor) {
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  }
  const [anoStr, mesStr] = valor.split("-");
  return { ano: Number(anoStr), mes: Number(mesStr) };
}

function descricaoEstado(estado: EstadoDia): string {
  switch (estado) {
    case "disponivel":
      return "disponível";
    case "selecionado":
      return "selecionado";
    default:
      return "indisponível";
  }
}

export function EventAvailabilityCalendar({ value, onChange }: EventAvailabilityCalendarProps) {
  const hoje = new Date();
  const [mesExibido, setMesExibido] = useState(() => parseAnoMes(value, hoje));
  const [datasOcupadas, setDatasOcupadas] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function buscarDatasOcupadas() {
      try {
        const params = new URLSearchParams({
          ano: String(mesExibido.ano),
          mes: String(mesExibido.mes),
        });
        const resposta = await fetch(`/api/eventos/disponibilidade-mes?${params}`);
        if (!resposta.ok || cancelado) return;
        const corpo = await resposta.json();
        if (!cancelado) setDatasOcupadas(corpo.datasOcupadas ?? []);
      } catch {
        // Se a busca falhar, o calendário fica sem marcação de ocupação;
        // "Verificar disponibilidade" ainda protege a reserva no servidor.
      }
    }
    buscarDatasOcupadas();
    return () => {
      cancelado = true;
    };
  }, [mesExibido.ano, mesExibido.mes]);

  const mesAtualReal = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const noMesAtual = mesExibido.ano === mesAtualReal.ano && mesExibido.mes === mesAtualReal.mes;

  function irParaMesAnterior() {
    setMesExibido((atual) => {
      const mes = atual.mes === 1 ? 12 : atual.mes - 1;
      const ano = atual.mes === 1 ? atual.ano - 1 : atual.ano;
      return { ano, mes };
    });
  }

  function irParaProximoMes() {
    setMesExibido((atual) => {
      const mes = atual.mes === 12 ? 1 : atual.mes + 1;
      const ano = atual.mes === 12 ? atual.ano + 1 : atual.ano;
      return { ano, mes };
    });
  }

  const celulas = construirGradeDoMes({
    ano: mesExibido.ano,
    mes: mesExibido.mes,
    hoje,
    datasOcupadas,
    dataSelecionada: value,
  });

  return (
    <div className={styles.calendario}>
      <div className={styles.cabecalho}>
        <button
          type="button"
          onClick={irParaMesAnterior}
          disabled={noMesAtual}
          aria-label="Mês anterior"
          className={styles.botaoNavegacao}
        >
          ‹
        </button>
        <span className={styles.tituloMes}>
          {NOMES_MESES[mesExibido.mes - 1]} de {mesExibido.ano}
        </span>
        <button
          type="button"
          onClick={irParaProximoMes}
          aria-label="Próximo mês"
          className={styles.botaoNavegacao}
        >
          ›
        </button>
      </div>

      <div className={styles.gradeDiasSemana}>
        {DIAS_SEMANA.map((dia) => (
          <span key={dia} className={styles.diaSemana}>
            {dia}
          </span>
        ))}
      </div>

      <div className={styles.gradeDias}>
        {celulas.map((celula, indice) =>
          celula === null ? (
            <span key={`vazio-${indice}`} className={styles.diaVazio} />
          ) : (
            <button
              key={celula.data}
              type="button"
              className={`${styles.diaBotao} ${styles[`dia_${celula.estado}`]}`}
              disabled={celula.estado === "passado" || celula.estado === "ocupado"}
              aria-label={`${celula.diaDoMes} de ${NOMES_MESES[mesExibido.mes - 1]}, ${descricaoEstado(celula.estado)}`}
              onClick={() => onChange(celula.data)}
            >
              {celula.diaDoMes}
            </button>
          )
        )}
      </div>
    </div>
  );
}
