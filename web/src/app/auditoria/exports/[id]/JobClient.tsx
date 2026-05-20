"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR" | string;
  format: "CSV" | "JSON" | string;
  limit: number;
  arquivoPath?: string | null;
  error?: string | null;
};

async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`/api/auditoria/exports/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as Job;
}

export function JobClient({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldPoll = job?.status === "PENDING" || job?.status === "RUNNING";
  const title = useMemo(() => {
    if (!job) return "Export job";
    return `${job.format} • ${job.status} • limite ${job.limit}`;
  }, [job]);

  useEffect(() => {
    let timer: number | null = null;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const next = await fetchJob(id);
      if (cancelled) return;
      setJob(next);
      setLoading(false);
    };

    run();

    if (shouldPoll) {
      timer = window.setInterval(() => {
        run();
      }, 2000);
    }

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [id, shouldPoll]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Export job</h1>
          <p className="mt-1 text-sm text-zinc-700">
            {title}
            {loading ? <span className="text-zinc-500"> • atualizando...</span> : null}
          </p>
        </div>
        <Link
          href="/auditoria/exports"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Voltar
        </Link>
      </div>

      {!job ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          Job não encontrado.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          <div>
            <span className="font-medium">ID</span>:{" "}
            <span className="font-mono">{job.id}</span>
          </div>
          <div className="mt-1">
            <span className="font-medium">Status</span>: {job.status}
            {shouldPoll ? (
              <span className="text-zinc-500"> • (auto)</span>
            ) : null}
          </div>
          {job.status === "PENDING" || job.status === "RUNNING" ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
              Gerando export…
            </div>
          ) : null}
          {job.arquivoPath ? (
            <div className="mt-1">
              <span className="font-medium">Arquivo</span>:{" "}
              <span className="font-mono">{job.arquivoPath}</span>
            </div>
          ) : null}
          {job.status === "ERROR" ? (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-900">
              {job.error || "Falha ao gerar export."}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchJob(id).then((j) => setJob(j))}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Atualizar agora
            </button>
            {job.status === "DONE" ? (
              <a
                href={`/api/auditoria/exports/${job.id}/download`}
                className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Baixar
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

