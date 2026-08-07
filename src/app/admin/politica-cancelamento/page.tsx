"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { AdminRole } from "@/lib/auth/roles";

interface Tier {
  id: string;
  diasMinimos: number;
  diasMaximos: number | null;
  percentualReembolso: string;
}

export default function PoliticaCancelamentoPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: AdminRole } | undefined)?.role;
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await fetch("/api/admin/politica-cancelamento");
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível carregar a política");
        return;
      }
      setTiers(corpo.tiers);
    } catch {
      setErro("não foi possível carregar a política");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function atualizarTier(index: number, campo: keyof Tier, valor: string) {
    const copia = [...tiers];
    copia[index] = { ...copia[index], [campo]: valor } as Tier;
    setTiers(copia);
  }

  async function salvar() {
    setErro("");
    setSucesso("");
    const payload = tiers.map((t) => ({
      diasMinimos: Number(t.diasMinimos),
      diasMaximos:
        t.diasMaximos === null || (t.diasMaximos as unknown) === "" ? null : Number(t.diasMaximos),
      percentualReembolso: Number(t.percentualReembolso),
    }));

    try {
      const resposta = await fetch("/api/admin/politica-cancelamento", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "não foi possível salvar a política");
        return;
      }

      setSucesso("Política atualizada com sucesso");
      await carregar();
    } catch {
      setErro("não foi possível salvar a política");
    }
  }

  return (
    <main>
      <h1>Política de Cancelamento</h1>
      {erro && <p role="alert">{erro}</p>}
      {sucesso && <p role="status">{sucesso}</p>}
      <table>
        <thead>
          <tr>
            <th>Dias mínimos</th>
            <th>Dias máximos</th>
            <th>% de reembolso</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, index) => (
            <tr key={tier.id}>
              <td>
                <input
                  type="number"
                  value={tier.diasMinimos}
                  disabled={role !== "DONO"}
                  onChange={(e) => atualizarTier(index, "diasMinimos", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={tier.diasMaximos ?? ""}
                  disabled={role !== "DONO"}
                  onChange={(e) => atualizarTier(index, "diasMaximos", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={tier.percentualReembolso}
                  disabled={role !== "DONO"}
                  onChange={(e) => atualizarTier(index, "percentualReembolso", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === "DONO" && (
        <button type="button" onClick={salvar}>
          Salvar política
        </button>
      )}
    </main>
  );
}
