"use client";

import { useMemo, useState } from "react";

type InstCandidate = {
  id: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
};

type ProcCandidate = {
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

async function fetchPreviewInstituicao(args: { loteId: string; fromId: string; toId: string }) {
  const res = await fetch(
    `/api/reconciliacao/preview/instituicao?loteId=${encodeURIComponent(args.loteId)}&fromId=${encodeURIComponent(args.fromId)}&toId=${encodeURIComponent(args.toId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const msg = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: msg?.message || "Falha ao obter prévia." } as const;
  }
  return (await res.json()) as PreviewResult;
}

async function fetchPreviewProcesso(args: { loteId: string; fromId: string; toId: string }) {
  const res = await fetch(
    `/api/reconciliacao/preview/processo?loteId=${encodeURIComponent(args.loteId)}&fromId=${encodeURIComponent(args.fromId)}&toId=${encodeURIComponent(args.toId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const msg = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: msg?.message || "Falha ao obter prévia." } as const;
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
        data.blocked ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"
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
        <div className="mt-1">
          Avisos: {data.warnings.slice(0, 3).join(" • ")}
        </div>
      ) : null}
    </div>
  );
}

export function SuggestedReconcileInstituicoes(props: {
  loteId: string;
  rows: Array<{
    id: string;
    nome: string;
    cnpj: string | null;
    sourceRef: string | null;
    candidates: InstCandidate[];
  }>;
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {props.rows.map((i) => (
        <SuggestedInstCard key={i.id} loteId={props.loteId} row={i} mergeAction={props.mergeAction} />
      ))}
    </div>
  );
}

function SuggestedInstCard(props: {
  loteId: string;
  row: {
    id: string;
    nome: string;
    cnpj: string | null;
    sourceRef: string | null;
    candidates: InstCandidate[];
  };
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [toId, setToId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const canPreview = Boolean(toId);
  const canReconcile = Boolean(toId) && confirm && !(preview?.ok && preview.blocked);

  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-sm font-medium text-zinc-900">{props.row.nome}</div>
      <div className="mt-0.5 text-[11px] text-zinc-600">
        {props.row.cnpj ? `CNPJ ${props.row.cnpj}` : "CNPJ —"}
        {" • "}
        {props.row.sourceRef ? `Ref: ${props.row.sourceRef}` : "Ref: —"}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <select
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setPreview(null);
              setConfirm(false);
            }}
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value="" disabled>
              Selecione destino…
            </option>
            {props.row.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.cnpj ? ` • ${c.cnpj}` : ""}
                {c.municipio ? ` • ${c.municipio}` : ""}
                {c.uf ? `/${c.uf}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <button
            type="button"
            disabled={!canPreview || loading}
            onClick={async () => {
              if (!toId) return;
              setLoading(true);
              const r = await fetchPreviewInstituicao({
                loteId: props.loteId,
                fromId: props.row.id,
                toId,
              });
              setPreview(r);
              setLoading(false);
            }}
            className={`h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 ${
              !canPreview || loading ? "opacity-50" : ""
            }`}
            title={!canPreview ? "Selecione um destino para ver a prévia." : undefined}
          >
            {loading ? "Prévia…" : "Prévia"}
          </button>
        </div>

        <div className="sm:col-span-1 flex items-center">
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-800">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              disabled={!toId}
            />
            Confirmar
          </label>
        </div>

        <div className="sm:col-span-1">
          <form action={props.mergeAction}>
            <input type="hidden" name="loteId" value={props.loteId} />
            <input type="hidden" name="fromInstituicaoId" value={props.row.id} />
            <input type="hidden" name="toInstituicaoId" value={toId} />
            <input type="hidden" name="confirm" value={confirm ? "1" : ""} />
            <button
              disabled={!canReconcile}
              className={`h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 ${
                !canReconcile ? "opacity-50" : ""
              }`}
              title={
                !toId
                  ? "Selecione um destino."
                  : preview?.ok && preview.blocked
                    ? "Prévia indica colisões. Ajuste antes de reconciliar."
                    : !confirm
                      ? "Marque Confirmar."
                      : undefined
              }
            >
              Reconciliar
            </button>
          </form>
        </div>
      </div>

      <PreviewBox data={preview} />
    </div>
  );
}

export function SuggestedReconcileProcessos(props: {
  loteId: string;
  rows: Array<{
    id: string;
    numero: string | null;
    ano: number | null;
    status: string;
    instituicaoNome: string;
    sourceRef: string | null;
    candidates: ProcCandidate[];
  }>;
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {props.rows.map((p) => (
        <SuggestedProcCard key={p.id} loteId={props.loteId} row={p} mergeAction={props.mergeAction} />
      ))}
    </div>
  );
}

function SuggestedProcCard(props: {
  loteId: string;
  row: {
    id: string;
    numero: string | null;
    ano: number | null;
    status: string;
    instituicaoNome: string;
    sourceRef: string | null;
    candidates: ProcCandidate[];
  };
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [toId, setToId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const canPreview = Boolean(toId);
  const canReconcile = Boolean(toId) && confirm && !(preview?.ok && preview.blocked);

  const header = useMemo(() => {
    const num = props.row.numero ?? "(sem número)";
    const ano = props.row.ano ? `/${props.row.ano}` : "";
    return `Processo ${num}${ano} • ${props.row.status}`;
  }, [props.row.ano, props.row.numero, props.row.status]);

  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-sm font-medium text-zinc-900">{header}</div>
      <div className="mt-0.5 text-[11px] text-zinc-600">
        Instituição: {props.row.instituicaoNome}
        {" • "}
        {props.row.sourceRef ? `Ref: ${props.row.sourceRef}` : "Ref: —"}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <select
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
              setPreview(null);
              setConfirm(false);
            }}
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value="" disabled>
              Selecione destino…
            </option>
            {props.row.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero ?? "(sem número)"}
                {c.ano ? `/${c.ano}` : ""}
                {c.status ? ` • ${c.status}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <button
            type="button"
            disabled={!canPreview || loading}
            onClick={async () => {
              if (!toId) return;
              setLoading(true);
              const r = await fetchPreviewProcesso({
                loteId: props.loteId,
                fromId: props.row.id,
                toId,
              });
              setPreview(r);
              setLoading(false);
            }}
            className={`h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 ${
              !canPreview || loading ? "opacity-50" : ""
            }`}
            title={!canPreview ? "Selecione um destino para ver a prévia." : undefined}
          >
            {loading ? "Prévia…" : "Prévia"}
          </button>
        </div>

        <div className="sm:col-span-1 flex items-center">
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-800">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              disabled={!toId}
            />
            Confirmar
          </label>
        </div>

        <div className="sm:col-span-1">
          <form action={props.mergeAction}>
            <input type="hidden" name="loteId" value={props.loteId} />
            <input type="hidden" name="fromProcessoId" value={props.row.id} />
            <input type="hidden" name="toProcessoId" value={toId} />
            <input type="hidden" name="confirm" value={confirm ? "1" : ""} />
            <button
              disabled={!canReconcile}
              className={`h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 ${
                !canReconcile ? "opacity-50" : ""
              }`}
              title={
                !toId
                  ? "Selecione um destino."
                  : preview?.ok && preview.blocked
                    ? "Prévia indica colisões. Ajuste antes de reconciliar."
                    : !confirm
                      ? "Marque Confirmar."
                      : undefined
              }
            >
              Reconciliar
            </button>
          </form>
        </div>
      </div>

      <PreviewBox data={preview} />
    </div>
  );
}

