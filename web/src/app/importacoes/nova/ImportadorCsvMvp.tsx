"use client";

import { useActionState, useMemo, useState } from "react";
import { previewImportAction, runImportAction } from "./actions";
import { formatCnpj } from "@/server/normalize";

type PreviewOk = Awaited<ReturnType<typeof previewImportAction>> & { ok: true };
type PreviewErr = Awaited<ReturnType<typeof previewImportAction>> & { ok: false };
type PreviewState = null | PreviewOk | PreviewErr;

function isOk(state: PreviewState): state is PreviewOk {
  return !!state && (state as PreviewOk).ok === true;
}

function isErr(state: PreviewState): state is PreviewErr {
  return !!state && (state as PreviewErr).ok === false;
}

export function ImportadorCsvMvp() {
  const [state, formAction, pending] = useActionState(
    async (_prev: PreviewState, formData: FormData) => {
      return (await previewImportAction(formData)) as PreviewState;
    },
    null,
  );

  const canRun = isOk(state) && state.preview.errors.length === 0;
  const [reconc, setReconc] = useState<Record<number, string>>({});
  const [onlyPartial, setOnlyPartial] = useState(false);
  const [reconQuery, setReconQuery] = useState("");
  const [reconPage, setReconPage] = useState(1);
  const reconPageSize = 25;

  const sugestoes = useMemo(() => {
    if (!isOk(state)) return [];
    return (state as PreviewOk).sugestoes ?? [];
  }, [state]);

  const sugestoesFiltered = useMemo(() => {
    const q = reconQuery.trim().toLowerCase();
    let list = onlyPartial ? sugestoes.filter((s) => s.matchLevel === "PARCIAL") : sugestoes;
    if (q) {
      list = list.filter((s) => {
        const muniUf = `${s.municipio ?? ""} ${s.uf ?? ""}`.trim().toLowerCase();
        return (
          (s.nome ?? "").toLowerCase().includes(q) ||
          muniUf.includes(q) ||
          String(s.rowNumber).includes(q)
        );
      });
    }
    return list;
  }, [onlyPartial, reconQuery, sugestoes]);

  const reconTotalPages = Math.max(1, Math.ceil(sugestoesFiltered.length / reconPageSize));
  const reconPageSafe = Math.min(reconTotalPages, Math.max(1, reconPage));
  const sugestoesPage = sugestoesFiltered.slice(
    (reconPageSafe - 1) * reconPageSize,
    reconPageSafe * reconPageSize,
  );

  const summary = useMemo(() => {
    if (!isOk(state)) return null;
    return {
      sampleCount: state.preview.sample.length,
      errorCount: state.preview.errors.length,
    };
  }, [state]);

  const dryRun = useMemo(() => {
    if (!isOk(state)) return null;
    return (state as PreviewOk).dryRunImpact ?? null;
  }, [state]);

  const reconSummary = useMemo(() => {
    if (sugestoes.length === 0) return null;
    let exato = 0;
    let parcial = 0;
    for (const s of sugestoes) {
      if (s.matchLevel === "EXATO") exato++;
      else parcial++;
    }
    return { total: sugestoes.length, exato, parcial };
  }, [sugestoes]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form
        action={formAction}
        className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4"
      >
        <div className="text-sm font-semibold">1) Upload e preview</div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/importacoes/template.csv"
            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Baixar template CSV
          </a>
          <a
            href="/api/importacoes/template.xlsx"
            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Baixar template XLSX
          </a>
        </div>
        <input
          name="sheetName"
          className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          placeholder="(Opcional p/ XLSX) Nome da aba a importar (ex.: IMPORTACAO_MVP)"
        />
        <input
          name="arquivo"
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200"
          required
        />
        <button
          disabled={pending}
          className="h-10 w-full rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Gerando..." : "Gerar preview"}
        </button>

        {isErr(state) ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.message}
          </div>
        ) : null}

        {summary ? (
          <div className="space-y-2">
            <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              Amostra: <span className="font-medium">{summary.sampleCount}</span>{" "}
              linha(s) • Erros: <span className="font-medium">{summary.errorCount}</span>
            </div>
            {isOk(state)
              ? (() => {
                  const si = state.sourceInfo as unknown;
                  if (!si || typeof si !== "object") return null;
                  const m = si as Record<string, unknown>;
                  if (m.kind !== "xlsx" && m.kind !== "csv") return null;
                  return (
                    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
                      Fonte:{" "}
                      <span className="font-medium">{m.kind === "xlsx" ? "XLSX" : "CSV"}</span>
                      {m.kind === "xlsx" ? (
                        <>
                          {" "}
                          • Aba <span className="font-medium">{String(m.sheetName ?? "")}</span>
                        </>
                      ) : (
                        <>
                          {" "}
                          • Delimitador <span className="font-medium">{String(m.delimiter ?? "")}</span>
                        </>
                      )}{" "}
                      • <span className="font-medium">{String(m.rows ?? "")}</span> linha(s) •{" "}
                      <span className="font-medium">{String(m.cols ?? "")}</span> coluna(s)
                      {Array.isArray(m.availableSheets) && m.availableSheets.length ? (
                        <div className="mt-1 text-[11px] text-zinc-600">
                          Abas disponíveis:{" "}
                          <span className="font-medium">
                            {(m.availableSheets.filter((x) => typeof x === "string") as string[]).join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {Array.isArray(m.detectedHeaders) && m.detectedHeaders.length ? (
                        <div className="mt-1 text-[11px] text-zinc-600">
                          Headers detectados:{" "}
                          <span className="font-medium">
                            {(m.detectedHeaders.filter((x) => typeof x === "string") as string[]).join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {Array.isArray(m.missingColumns) && m.missingColumns.length ? (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                          <span className="font-semibold">Atenção</span>: colunas não detectadas no arquivo (serão importadas vazias):{" "}
                          <span className="font-medium">
                            {(m.missingColumns.filter((x) => typeof x === "string") as string[]).join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })()
              : null}
          </div>
        ) : (
          <p className="text-xs text-zinc-600">
            Dica: export do Excel costuma vir com `;` e Windows-1252. O preview
            agora tenta detectar isso automaticamente.
          </p>
        )}

        {isOk(state) && state.preview.errors.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800">
              Erros (até 2000 analisados)
            </div>
            <ul className="divide-y divide-zinc-200">
              {state.preview.errors.slice(0, 50).map((e, idx) => (
                <li key={`${e.rowNumber}-${idx}`} className="px-3 py-2 text-xs text-zinc-700">
                  <span className="font-medium">Linha {e.rowNumber}</span>:{" "}
                  {e.message}
                </li>
              ))}
              {state.preview.errors.length > 50 ? (
                <li className="px-3 py-2 text-xs text-zinc-600">
                  ... e mais {state.preview.errors.length - 50} erro(s)
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {dryRun ? (
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800">
              Dry-run (estimativa) — {dryRun.analyzedRows} linha(s) analisadas
            </div>
            <div className="grid grid-cols-1 gap-2 p-3 text-[11px] text-zinc-700">
              <div>
                <span className="font-semibold">Instituições</span>: +{dryRun.instituicoes.created} criadas •{" "}
                {dryRun.instituicoes.updated} atualizadas
              </div>
              <div>
                <span className="font-semibold">Processos</span>: +{dryRun.processos.created} criados •{" "}
                {dryRun.processos.updated} atualizados
              </div>
              <div>
                <span className="font-semibold">Atos</span>: +{dryRun.atos.created} criados •{" "}
                {dryRun.atos.updated} atualizados
              </div>
              <div>
                <span className="font-semibold">Eventos</span>: +{dryRun.eventos.created} criados •{" "}
                {dryRun.eventos.updated} atualizados
              </div>
              <div>
                <span className="font-semibold">Documentos</span>: +{dryRun.documentos.created} criados •{" "}
                {dryRun.documentos.updated} atualizados
              </div>
            </div>
          </div>
        ) : null}

        {isOk(state) ? (
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800">
              Amostra (até 20)
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-[11px] leading-5">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-zinc-200 text-left text-zinc-700">
                    <th className="px-3 py-2 font-semibold">Linha</th>
                    <th className="px-3 py-2 font-semibold">Instituição</th>
                    <th className="px-3 py-2 font-semibold">CNPJ</th>
                    <th className="px-3 py-2 font-semibold">Município/UF</th>
                    <th className="px-3 py-2 font-semibold">Processo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {state.preview.sample.map((s) => {
                    const cnpjRaw = s.data.instituicao_cnpj ?? "";
                    const cnpjFmt = cnpjRaw ? formatCnpj(cnpjRaw) : "";
                    const muni = s.data.instituicao_municipio ?? "";
                    const uf = s.data.instituicao_uf ?? "";
                    const proc = s.data.processo_numero ?? "";
                    const procAno = s.data.processo_ano ?? "";
                    const procText = proc || procAno ? `${proc}${procAno ? `/${procAno}` : ""}` : "";
                    return (
                      <tr key={s.rowNumber} className="text-zinc-800">
                        <td className="px-3 py-2 align-top text-zinc-600">{s.rowNumber}</td>
                        <td className="px-3 py-2 align-top">{s.data.instituicao_nome ?? ""}</td>
                        <td className="px-3 py-2 align-top">{cnpjFmt}</td>
                        <td className="px-3 py-2 align-top">
                          {muni}
                          {uf ? `/${uf}` : ""}
                        </td>
                        <td className="px-3 py-2 align-top">{procText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </form>

      <form
        action={runImportAction}
        className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4"
      >
        <div className="text-sm font-semibold">2) Executar importação</div>
        <p className="text-sm text-zinc-700">
          Depois do preview, a importação usa exatamente o mesmo CSV.
        </p>

        <input
          name="arquivoNome"
          className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          placeholder="Nome do arquivo (ex.: import.csv)"
          defaultValue={isOk(state) ? state.arquivoNome : ""}
          required
          readOnly={!isOk(state)}
        />
        <input type="hidden" name="csvText" value={isOk(state) ? state.csvText : ""} />
        <input
          type="hidden"
          name="sourceInfoJson"
          value={isOk(state) && state.sourceInfo ? JSON.stringify(state.sourceInfo) : ""}
        />
        <input type="hidden" name="reconciliacoesJson" value={JSON.stringify(reconc)} />

        {isOk(state) && sugestoes.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800">
              Reconciliação assistida (linhas sem CNPJ)
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2">
              <div className="text-[11px] text-zinc-600">
                {reconSummary
                  ? `${reconSummary.total} linha(s): ${reconSummary.exato} match(es) exato(s) • ${reconSummary.parcial} parcial(is)`
                  : `${sugestoes.length} linha(s) com sugestão(ões).`}
              </div>
              <label className="inline-flex items-center gap-2 text-[11px] text-zinc-700">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-zinc-300"
                  checked={onlyPartial}
                  onChange={(e) => {
                    setOnlyPartial(e.target.checked);
                    setReconPage(1);
                  }}
                />
                Mostrar apenas match parcial
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    setReconc((prev) => {
                      const next = { ...prev };
                      for (const s of sugestoes) {
                        if (!s.candidatos?.length) continue;
                        if (s.matchLevel !== "EXATO") continue;
                        if (!next[s.rowNumber] || next[s.rowNumber] === "NEW") {
                          next[s.rowNumber] = s.candidatos[0]!.id;
                        }
                      }
                      return next;
                    });
                  }}
                >
                  Aplicar 1ª sugestão (só exatos)
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    setReconc((prev) => {
                      const next = { ...prev };
                      for (const s of sugestoes) {
                        if (!s.candidatos?.length) continue;
                        if (!next[s.rowNumber] || next[s.rowNumber] === "NEW") {
                          next[s.rowNumber] = s.candidatos[0]!.id;
                        }
                      }
                      return next;
                    });
                  }}
                >
                  Aplicar 1ª sugestão (todas)
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    setReconc((prev) => {
                      const next = { ...prev };
                      for (const s of sugestoesPage) {
                        if (!s.candidatos?.length) continue;
                        if (!next[s.rowNumber] || next[s.rowNumber] === "NEW") {
                          next[s.rowNumber] = s.candidatos[0]!.id;
                        }
                      }
                      return next;
                    });
                  }}
                >
                  Aplicar 1ª sugestão (página)
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
                  onClick={() => setReconc({})}
                >
                  Limpar seleções
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2">
              <input
                value={reconQuery}
                onChange={(e) => {
                  setReconQuery(e.target.value);
                  setReconPage(1);
                }}
                placeholder="Filtrar (nome, município, UF ou linha)"
                className="h-9 w-full max-w-md rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              />
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span>
                  {sugestoesFiltered.length} item(ns) • página {reconPageSafe} de {reconTotalPages}
                </span>
                <button
                  type="button"
                  disabled={reconPageSafe <= 1}
                  onClick={() => setReconPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={reconPageSafe >= reconTotalPages}
                  onClick={() => setReconPage((p) => Math.min(reconTotalPages, p + 1))}
                  className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-[11px] leading-5">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-zinc-200 text-left text-zinc-700">
                    <th className="px-3 py-2 font-semibold">Linha</th>
                    <th className="px-3 py-2 font-semibold">Instituição (CSV)</th>
                    <th className="px-3 py-2 font-semibold">Sugestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {sugestoesPage.map((s) => {
                    const current = reconc[s.rowNumber] ?? "NEW";
                    return (
                      <tr key={s.rowNumber} className="text-zinc-800">
                        <td className="px-3 py-2 align-top text-zinc-600">{s.rowNumber}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{s.nome}</div>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                s.matchLevel === "EXATO"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : s.matchLevel === "MUNICIPIO_APROX"
                                    ? "bg-sky-50 text-sky-900 border border-sky-200"
                                    : "bg-amber-50 text-amber-900 border border-amber-200",
                              ].join(" ")}
                            >
                              {s.matchLevel === "EXATO"
                                ? "match exato"
                                : s.matchLevel === "MUNICIPIO_APROX"
                                  ? "município aprox."
                                  : "match parcial"}
                            </span>
                          </div>
                          <div className="text-zinc-600">
                            {(s.municipio ?? "") + (s.uf ? `/${s.uf}` : "")}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                            value={current}
                            onChange={(e) =>
                              setReconc((prev) => ({
                                ...prev,
                                [s.rowNumber]: e.target.value,
                              }))
                            }
                          >
                            <option value="NEW">Criar nova</option>
                            {s.candidatos.map((c) => (
                              <option key={c.id} value={c.id}>
                                Usar existente: {c.nome}
                                {c.cnpj ? ` • CNPJ ${formatCnpj(c.cnpj)}` : ""}
                                {c.municipio ? ` • ${c.municipio}` : ""}
                                {c.uf ? `/${c.uf}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 text-[11px] text-zinc-600">
              Dica: selecione uma instituição existente para evitar duplicidades quando o CSV não tiver CNPJ.
            </div>
          </div>
        ) : null}

        <button
          disabled={!canRun}
          className="h-10 w-full rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          Importar agora
        </button>

        {!isOk(state) ? (
          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            Gere o preview para habilitar a importação.
          </div>
        ) : state.preview.errors.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Corrija os erros do CSV antes de importar.
          </div>
        ) : null}
      </form>
    </div>
  );
}

