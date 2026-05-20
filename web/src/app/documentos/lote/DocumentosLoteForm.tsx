"use client";

import { useState } from "react";
import { ProcessoSelect } from "./ProcessoSelect";
import { uploadDocumentosEmLoteAction } from "./actions";
import { AtoSelect } from "./AtoSelect";
import { EventoSelect } from "./EventoSelect";

type InstituicaoOption = {
  id: string;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  municipio: string | null;
};

type TipoOption = {
  id: string;
  codigo: string;
  nome: string;
};

export function DocumentosLoteForm({
  instituicoes,
  tipos,
}: {
  instituicoes: InstituicaoOption[];
  tipos: TipoOption[];
}) {
  const [instituicaoId, setInstituicaoId] = useState("");

  return (
    <form action={uploadDocumentosEmLoteAction} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <label className="text-xs font-medium text-zinc-800" htmlFor="instituicaoId">
          Instituição
        </label>
        <select
          id="instituicaoId"
          name="instituicaoId"
          value={instituicaoId}
          onChange={(e) => setInstituicaoId(e.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          required
        >
          <option value="" disabled>
            Selecione…
          </option>
          {instituicoes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
              {i.municipio ? ` • ${i.municipio}` : ""}
              {i.uf ? `/${i.uf}` : ""}
            </option>
          ))}
        </select>
        <div className="mt-1 text-[11px] text-zinc-600">
          Lista limitada a 200 (ordem alfabética). Se precisar, refinamos com busca.
        </div>
      </div>

      <div className="sm:col-span-3">
        <ProcessoSelect instituicaoId={instituicaoId} />
        <div className="mt-1 text-[11px] text-zinc-600">
          Dica: selecione a instituição primeiro para carregar os processos.
        </div>
      </div>

      <div className="sm:col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AtoSelect instituicaoId={instituicaoId} />
        <EventoSelect instituicaoId={instituicaoId} />
        <div className="sm:col-span-2 text-[11px] text-zinc-600">
          Escolha no máximo um vínculo: <span className="font-medium">processo</span> ou{" "}
          <span className="font-medium">ato</span> ou <span className="font-medium">evento</span>.
        </div>
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-zinc-800" htmlFor="tipoDocumentoCodigo">
          Tipo
        </label>
        <select
          id="tipoDocumentoCodigo"
          name="tipoDocumentoCodigo"
          defaultValue={tipos.find((t) => t.codigo === "OUTRO")?.codigo ?? "OUTRO"}
          className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
        >
          {tipos.map((t) => (
            <option key={t.id} value={t.codigo}>
              {t.codigo}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-zinc-800" htmlFor="dataDocumento">
          Data (opcional)
        </label>
        <input
          id="dataDocumento"
          name="dataDocumento"
          type="date"
          className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-zinc-900 outline-none focus:border-zinc-400"
        />
      </div>

      <div className="sm:col-span-6">
        <label className="text-xs font-medium text-zinc-800" htmlFor="arquivos">
          Arquivos (soltos)
        </label>
        <input
          id="arquivos"
          name="arquivos"
          type="file"
          multiple
          className="mt-1 block w-full text-xs text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-900 hover:file:bg-zinc-200"
        />
        <div className="mt-1 text-[11px] text-zinc-600">
          Use este campo para selecionar vários arquivos. O título será derivado do nome do arquivo (sem extensão).
        </div>
      </div>

      <div className="sm:col-span-6">
        <div className="text-center text-[11px] font-medium text-zinc-500">OU</div>
      </div>

      <div className="sm:col-span-6">
        <label className="text-xs font-medium text-zinc-800" htmlFor="zip">
          ZIP (upload em lote)
        </label>
        <input
          id="zip"
          name="zip"
          type="file"
          accept=".zip,application/zip"
          className="mt-1 block w-full text-xs text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-900 hover:file:bg-zinc-200"
        />
        <div className="mt-1 text-[11px] text-zinc-600">
          Envie um único <span className="font-mono">.zip</span> com vários arquivos. Não selecione arquivos soltos junto.
        </div>
      </div>

      <div className="sm:col-span-2">
        <button className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
          Enviar
        </button>
      </div>
    </form>
  );
}

