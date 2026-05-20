"use client";

import { useMemo, useState } from "react";

export function AjustesLoteClient(props: {
  loteId: string;
  instituicoes: Array<{
    id: string;
    nome: string;
    municipio: string | null;
    uf: string | null;
    sourceRef: string | null;
    missingMunicipio: boolean;
    missingUf: boolean;
    dupCountNome: number;
  }>;
  processos: Array<{
    id: string;
    numero: string | null;
    ano: number | null;
    status: string;
    assunto: string | null;
    instituicaoId: string;
    instituicaoNome: string;
    sourceRef: string | null;
    missingNumero: boolean;
    missingAno: boolean;
    dupCountKey: number;
  }>;
  updateInstituicoesAction: (formData: FormData) => void | Promise<void>;
  updateProcessosAction: (formData: FormData) => void | Promise<void>;
}) {
  const [instSel, setInstSel] = useState<Record<string, boolean>>({});
  const [procSel, setProcSel] = useState<Record<string, boolean>>({});
  const [showOnlyInstIssues, setShowOnlyInstIssues] = useState(false);
  const [showOnlyProcIssues, setShowOnlyProcIssues] = useState(false);

  const instIds = useMemo(
    () => props.instituicoes.filter((i) => instSel[i.id]).map((i) => i.id),
    [instSel, props.instituicoes],
  );
  const procIds = useMemo(
    () => props.processos.filter((p) => procSel[p.id]).map((p) => p.id),
    [procSel, props.processos],
  );

  const toggleAllInst = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const i of props.instituicoes) next[i.id] = value;
    setInstSel(next);
  };
  const toggleAllProc = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const p of props.processos) next[p.id] = value;
    setProcSel(next);
  };

  const instWithIssues = useMemo(() => {
    return props.instituicoes.filter((i) => i.dupCountNome > 1 || i.missingMunicipio || i.missingUf);
  }, [props.instituicoes]);
  const procWithIssues = useMemo(() => {
    return props.processos.filter((p) => p.dupCountKey > 1 || p.missingNumero || p.missingAno);
  }, [props.processos]);

  const instRows = showOnlyInstIssues ? instWithIssues : props.instituicoes;
  const procRows = showOnlyProcIssues ? procWithIssues : props.processos;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Instituições do lote</div>
            <div className="mt-1 text-xs text-zinc-600">
              Selecione e aplique ajustes em município/UF.
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">
                Pendências: {instWithIssues.length}
              </span>
              <label className="flex items-center gap-2 text-zinc-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300"
                  checked={showOnlyInstIssues}
                  onChange={(e) => setShowOnlyInstIssues(e.target.checked)}
                />
                Mostrar só pendências/duplicidades
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => toggleAllInst(true)}
            >
              Selecionar todas
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => toggleAllInst(false)}
            >
              Limpar
            </button>
          </div>
        </div>

        <form action={props.updateInstituicoesAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="hidden" name="loteId" value={props.loteId} />
          <input type="hidden" name="ids" value={JSON.stringify(instIds)} />
          <input
            name="municipio"
            placeholder="Novo município (opcional)"
            className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
          <input
            name="uf"
            placeholder="Nova UF (opcional)"
            className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Aplicar em {instIds.length} selecionada(s)
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {instRows.length} item(ns)
          </div>
          <ul className="divide-y divide-zinc-200">
            {instRows.map((i) => (
              <li key={i.id} className="flex items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                  checked={Boolean(instSel[i.id])}
                  onChange={(e) => setInstSel((p) => ({ ...p, [i.id]: e.target.checked }))}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900">{i.nome}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {(i.municipio ?? "Município não informado") + (i.uf ? `/${i.uf}` : "")}
                    {" • "}
                    {i.sourceRef ? `Ref: ${i.sourceRef}` : "Ref: —"}
                  </div>
                  {i.dupCountNome > 1 || i.missingMunicipio || i.missingUf ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {i.dupCountNome > 1 ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">
                          Duplicado no lote ({i.dupCountNome}x)
                        </span>
                      ) : null}
                      {i.missingMunicipio ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-900">
                          Município ausente
                        </span>
                      ) : null}
                      {i.missingUf ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-900">
                          UF ausente
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {instRows.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-zinc-700">
                Nenhuma instituição vinculada a este lote.
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Processos do lote</div>
            <div className="mt-1 text-xs text-zinc-600">
              Selecione e aplique ajustes em status/assunto.
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">
                Pendências: {procWithIssues.length}
              </span>
              <label className="flex items-center gap-2 text-zinc-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300"
                  checked={showOnlyProcIssues}
                  onChange={(e) => setShowOnlyProcIssues(e.target.checked)}
                />
                Mostrar só pendências/duplicidades
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => toggleAllProc(true)}
            >
              Selecionar todos
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-200 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => toggleAllProc(false)}
            >
              Limpar
            </button>
          </div>
        </div>

        <form action={props.updateProcessosAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="hidden" name="loteId" value={props.loteId} />
          <input type="hidden" name="ids" value={JSON.stringify(procIds)} />
          <select
            name="status"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            defaultValue=""
          >
            <option value="">(manter status)</option>
            <option value="ABERTO">ABERTO</option>
            <option value="EM_TRAMITACAO">EM_TRAMITACAO</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="ARQUIVADO">ARQUIVADO</option>
          </select>
          <input
            name="assunto"
            placeholder="Novo assunto (opcional)"
            className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Aplicar em {procIds.length} selecionado(s)
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {procRows.length} item(ns)
          </div>
          <ul className="divide-y divide-zinc-200">
            {procRows.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                  checked={Boolean(procSel[p.id])}
                  onChange={(e) => setProcSel((s) => ({ ...s, [p.id]: e.target.checked }))}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900">
                    Processo {p.numero ?? "(sem número)"}{p.ano ? `/${p.ano}` : ""} • {p.status}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    Instituição: {p.instituicaoNome}
                    {" • "}
                    {p.sourceRef ? `Ref: ${p.sourceRef}` : "Ref: —"}
                  </div>
                  {p.assunto ? (
                    <div className="mt-0.5 text-[11px] text-zinc-700">{p.assunto}</div>
                  ) : null}
                  {p.dupCountKey > 1 || p.missingNumero || p.missingAno ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {p.dupCountKey > 1 ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">
                          Duplicado no lote ({p.dupCountKey}x)
                        </span>
                      ) : null}
                      {p.missingNumero ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-900">
                          Número ausente
                        </span>
                      ) : null}
                      {p.missingAno ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-900">
                          Ano ausente
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {procRows.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-zinc-700">
                Nenhum processo vinculado a este lote.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

