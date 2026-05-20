"use client";

import { useMemo, useRef, useState } from "react";
import { SmartDateInput } from "@/components/SmartDateInput";

type ActionFn = (formData: FormData) => void | Promise<void>;

export function DocumentoEditForm(props: {
  instituicaoId: string;
  documentoId: string;
  tipoDocumentoCodigo: "OFICIO" | "PARECER" | "RESOLUCAO" | "OUTRO";
  dataDocumentoIso: string;
  titulo: string;
  hasAnexo: boolean;
  action: ActionFn;
}) {
  const [removeAnexo, setRemoveAnexo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fileDisabled = removeAnexo;
  const showRemove = props.hasAnexo;

  const tipoOptions = useMemo(
    () => [
      { value: "OFICIO" as const, label: "OFICIO" },
      { value: "PARECER" as const, label: "PARECER" },
      { value: "RESOLUCAO" as const, label: "RESOLUCAO" },
      { value: "OUTRO" as const, label: "OUTRO" },
    ],
    [],
  );

  return (
    <form action={props.action} className="mt-3 grid grid-cols-1 gap-2">
      <input type="hidden" name="instituicaoId" value={props.instituicaoId} />
      <input type="hidden" name="id" value={props.documentoId} />

      <select
        name="tipoDocumentoCodigo"
        defaultValue={props.tipoDocumentoCodigo}
        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
      >
        {tipoOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <SmartDateInput
        name="dataDocumento"
        defaultValueIso={props.dataDocumentoIso}
        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
      />

      <input
        name="titulo"
        defaultValue={props.titulo}
        placeholder="Título"
        className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
        required
      />

      {showRemove ? (
        <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            name="removerArquivo"
            value="1"
            checked={removeAnexo}
            onChange={(e) => {
              const checked = e.target.checked;
              setRemoveAnexo(checked);
              if (checked && fileRef.current) {
                fileRef.current.value = "";
              }
            }}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Remover anexo atual
        </label>
      ) : null}

      <input
        ref={fileRef}
        name="arquivo"
        type="file"
        disabled={fileDisabled}
        className="block w-full text-xs text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 disabled:opacity-60"
      />

      <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
        Salvar
      </button>
    </form>
  );
}

