"use client";

import { useEffect, useMemo, useState } from "react";

type Instituicao = {
  id: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
};

type Processo = {
  id: string;
  numero: string | null;
  ano: number | null;
  status: string;
};

type PreviewResult =
  | {
      ok: true;
      blocked: boolean;
      moved: Record<string, number>;
      warnings: string[];
    }
  | { ok: false; message: string };

async function fetchInstituicoes(q: string): Promise<Instituicao[]> {
  const res = await fetch(`/api/reconciliacao/instituicoes?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { rows: Instituicao[] };
  return data.rows ?? [];
}

async function fetchProcessos(instituicaoId: string, q: string): Promise<Processo[]> {
  const res = await fetch(
    `/api/reconciliacao/processos?instituicaoId=${encodeURIComponent(instituicaoId)}&q=${encodeURIComponent(q)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { rows: Processo[] };
  return data.rows ?? [];
}

async function previewInstituicao(args: { loteId: string; fromId: string; toId: string }): Promise<PreviewResult> {
  const res = await fetch(
    `/api/reconciliacao/preview/instituicao?loteId=${encodeURIComponent(args.loteId)}&fromId=${encodeURIComponent(args.fromId)}&toId=${encodeURIComponent(args.toId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const msg = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: msg?.message || "Falha ao obter prévia." };
  }
  return (await res.json()) as PreviewResult;
}

async function previewProcesso(args: { loteId: string; fromId: string; toId: string }): Promise<PreviewResult> {
  const res = await fetch(
    `/api/reconciliacao/preview/processo?loteId=${encodeURIComponent(args.loteId)}&fromId=${encodeURIComponent(args.fromId)}&toId=${encodeURIComponent(args.toId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const msg = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: msg?.message || "Falha ao obter prévia." };
  }
  return (await res.json()) as PreviewResult;
}

function PreviewBox({ data }: { data: PreviewResult | null }) {
  if (!data) return null;
  if (!data.ok) {
    return (
      <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900">
        {data.message}
      </div>
    );
  }
  const movedPairs = Object.entries(data.moved);
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-[11px] ${
        data.blocked
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <div className="font-medium">
        {data.blocked ? "Prévia: bloqueado por colisões" : "Prévia: pronto para reconciliar"}
      </div>
      <div className="mt-1">
        Impacto:{" "}
        {movedPairs.length
          ? movedPairs.map(([k, v]) => `${k}: ${v}`).join(", ")
          : "nenhum registro seria reatribuído."}
      </div>
      {data.warnings.length ? (
        <div className="mt-1">Avisos: {data.warnings.slice(0, 3).join(" • ")}</div>
      ) : null}
    </div>
  );
}

export function ManualReconcileInstituicao({
  loteId,
  fromOptions,
  mergeAction,
}: {
  loteId: string;
  fromOptions: Array<{ id: string; label: string }>;
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [fromId, setFromId] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Instituicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [toId, setToId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const qq = q.trim();
      if (qq.length < 3) {
        setRows([]);
        return;
      }
      setLoading(true);
      const r = await fetchInstituicoes(qq);
      if (!cancelled) setRows(r);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const canSubmit = Boolean(fromId);
  const canPreview = Boolean(fromId && toId);
  const canReconcile = Boolean(fromId && toId) && !(preview?.ok && preview.blocked);

  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-sm font-medium text-zinc-900">Buscar candidato manualmente (Instituição)</div>
      <div className="mt-1 text-xs text-zinc-600">
        Selecione a instituição importada e pesquise pelo nome/CNPJ para escolher o destino.
      </div>

      <form action={mergeAction} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <input type="hidden" name="loteId" value={loteId} />
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="fromInstituicaoId_manual">
            Origem (do lote)
          </label>
          <select
            id="fromInstituicaoId_manual"
            name="fromInstituicaoId"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione…
            </option>
            {fromOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="q_inst_manual">
            Buscar destino
          </label>
          <input
            id="q_inst_manual"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite ao menos 3 caracteres (ou CNPJ)"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
        </div>

        <div className="sm:col-span-4">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="toInstituicaoId_manual">
            Destino
          </label>
          <select
            id="toInstituicaoId_manual"
            name="toInstituicaoId"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setPreview(null);
            }}
            required
            disabled={!canSubmit}
          >
            <option value="" disabled>
              {loading ? "Carregando…" : "Selecione…"}
            </option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
                {r.cnpj ? ` • ${r.cnpj}` : ""}
                {r.municipio ? ` • ${r.municipio}` : ""}
                {r.uf ? `/${r.uf}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1 flex items-center">
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-800">
            <input type="checkbox" name="confirm" value="1" />
            Confirmar
          </label>
        </div>

        <div className="sm:col-span-1">
          <button
            disabled={!canReconcile}
            className={`h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 ${
              !canReconcile ? "opacity-50" : ""
            }`}
          >
            Reconciliar
          </button>
        </div>
      </form>

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!canPreview || previewLoading}
          onClick={async () => {
            if (!fromId || !toId) return;
            setPreviewLoading(true);
            const r = await previewInstituicao({ loteId, fromId, toId });
            setPreview(r);
            setPreviewLoading(false);
          }}
          className={`h-8 rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 ${
            !canPreview || previewLoading ? "opacity-50" : ""
          }`}
        >
          {previewLoading ? "Prévia…" : "Prévia"}
        </button>
      </div>
      <PreviewBox data={preview} />
    </div>
  );
}

export function ManualReconcileProcesso({
  loteId,
  fromOptions,
  mergeAction,
}: {
  loteId: string;
  fromOptions: Array<{ id: string; instituicaoId: string; label: string }>;
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [fromId, setFromId] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(false);
  const [toId, setToId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const from = useMemo(() => fromOptions.find((o) => o.id === fromId) ?? null, [fromId, fromOptions]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const qq = q.trim();
      if (!from?.instituicaoId || qq.length < 1) {
        setRows([]);
        return;
      }
      setLoading(true);
      const r = await fetchProcessos(from.instituicaoId, qq);
      if (!cancelled) setRows(r);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q, from?.instituicaoId]);

  const canSubmit = Boolean(fromId);
  const canPreview = Boolean(fromId && toId);
  const canReconcile = Boolean(fromId && toId) && !(preview?.ok && preview.blocked);

  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-sm font-medium text-zinc-900">Buscar candidato manualmente (Processo)</div>
      <div className="mt-1 text-xs text-zinc-600">
        Selecione o processo importado e pesquise por número/ano (ex.: <span className="font-mono">123/2026</span>).
      </div>

      <form action={mergeAction} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <input type="hidden" name="loteId" value={loteId} />
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="fromProcessoId_manual">
            Origem (do lote)
          </label>
          <select
            id="fromProcessoId_manual"
            name="fromProcessoId"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione…
            </option>
            {fromOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="q_proc_manual">
            Buscar destino (mesma instituição)
          </label>
          <input
            id="q_proc_manual"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: 123/2026"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            disabled={!from?.instituicaoId}
          />
        </div>

        <div className="sm:col-span-4">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="toProcessoId_manual">
            Destino
          </label>
          <select
            id="toProcessoId_manual"
            name="toProcessoId"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setPreview(null);
            }}
            required
            disabled={!canSubmit}
          >
            <option value="" disabled>
              {loading ? "Carregando…" : "Selecione…"}
            </option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.numero ?? "(sem número)"}
                {r.ano ? `/${r.ano}` : ""}
                {r.status ? ` • ${r.status}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1 flex items-center">
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-800">
            <input type="checkbox" name="confirm" value="1" />
            Confirmar
          </label>
        </div>

        <div className="sm:col-span-1">
          <button
            disabled={!canReconcile}
            className={`h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 ${
              !canReconcile ? "opacity-50" : ""
            }`}
          >
            Reconciliar
          </button>
        </div>
      </form>

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!canPreview || previewLoading}
          onClick={async () => {
            if (!fromId || !toId) return;
            setPreviewLoading(true);
            const r = await previewProcesso({ loteId, fromId, toId });
            setPreview(r);
            setPreviewLoading(false);
          }}
          className={`h-8 rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 ${
            !canPreview || previewLoading ? "opacity-50" : ""
          }`}
        >
          {previewLoading ? "Prévia…" : "Prévia"}
        </button>
      </div>
      <PreviewBox data={preview} />
    </div>
  );
}

