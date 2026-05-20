"use client";

import { useEffect, useState } from "react";

type ProcessoRow = {
  id: string;
  numero: string | null;
  ano: number | null;
  status: string;
};

export function ProcessoSelect({ instituicaoId }: { instituicaoId: string }) {
  const [rows, setRows] = useState<ProcessoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      setRows([]);
      if (!instituicaoId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/instituicoes/${instituicaoId}/processos`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Falha ao carregar processos.");
        const data = (await res.json()) as { rows: ProcessoRow[] };
        if (cancelled) return;
        setRows(data.rows ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [instituicaoId]);

  return (
    <div>
      <label className="text-xs font-medium text-zinc-800" htmlFor="processoId">
        Processo (opcional)
      </label>
      <select
        id="processoId"
        name="processoId"
        defaultValue=""
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
        disabled={!instituicaoId || loading}
      >
        <option value="">(sem vínculo)</option>
        {rows.map((p) => (
          <option key={p.id} value={p.id}>
            {p.numero ?? "(sem número)"}
            {p.ano ? `/${p.ano}` : ""} • {p.status}
          </option>
        ))}
      </select>
      {loading ? (
        <div className="mt-1 text-[11px] text-zinc-600">Carregando processos…</div>
      ) : null}
      {error ? <div className="mt-1 text-[11px] text-rose-700">{error}</div> : null}
    </div>
  );
}

