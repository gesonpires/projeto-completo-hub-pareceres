"use client";

import { useEffect, useMemo, useState } from "react";

type Row = { id: string; tipo: string; numero: string | null; dataAto: string };

export function AtoSelect({ instituicaoId }: { instituicaoId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setRows([]);
      setError(null);
      if (!instituicaoId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/instituicoes/${encodeURIComponent(instituicaoId)}/atos`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Falha ao carregar atos.");
        const data = (await res.json()) as { rows: Array<{ id: string; tipo: string; numero: string | null; dataAto: string }> };
        if (!cancelled) setRows(data.rows ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar atos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [instituicaoId]);

  const options = useMemo(
    () =>
      rows.map((r) => ({
        value: r.id,
        label: `${r.tipo}${r.numero ? ` ${r.numero}` : ""} • ${String(r.dataAto).slice(0, 10)}`,
      })),
    [rows],
  );

  return (
    <div>
      <label className="text-xs font-medium text-zinc-800" htmlFor="atoId">
        Ato (opcional)
      </label>
      <select
        id="atoId"
        name="atoId"
        defaultValue=""
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
        disabled={!instituicaoId || loading}
        title="Escolha apenas um vínculo: processo OU ato OU evento."
      >
        <option value="">{!instituicaoId ? "Selecione instituição…" : loading ? "Carregando…" : "(sem ato)"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <div className="mt-1 text-[11px] text-rose-700">{error}</div> : null}
    </div>
  );
}

