"use client";

import { useMemo, useState } from "react";
import { digitsOnly } from "@/server/normalize";

function splitNumeroAno(raw: string) {
  const groups = raw.match(/\d+/g) ?? [];
  const numero = groups[0] ? digitsOnly(groups[0]).slice(0, 20) : "";
  const ano = groups[1] ? digitsOnly(groups[1]).slice(0, 4) : "";
  return { numero, ano };
}

export function ProcessoNumeroAnoFields(props: {
  defaultNumero?: string | null;
  defaultAno?: string | number | null;
}) {
  const [numero, setNumero] = useState(() => digitsOnly(String(props.defaultNumero ?? "")).slice(0, 20));
  const [ano, setAno] = useState(() => digitsOnly(String(props.defaultAno ?? "")).slice(0, 4));

  const display = useMemo(() => {
    if (numero && ano) return `${numero}/${ano}`;
    if (numero) return numero;
    if (ano) return ano;
    return "";
  }, [numero, ano]);

  const invalidAno = ano.length > 0 && ano.length !== 4;

  return (
    <>
      <input type="hidden" name="numero" value={numero} />
      <input type="hidden" name="ano" value={ano} />
      <input
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          const { numero: n, ano: a } = raw.includes("/")
            ? splitNumeroAno(raw)
            : { numero: digitsOnly(raw).slice(0, 20), ano: "" };

          setNumero(n);
          setAno(a);

          if (a.length > 0 && a.length !== 4) {
            e.target.setCustomValidity("Ano inválido. Informe 4 dígitos (ex.: 2024).");
          } else {
            e.target.setCustomValidity("");
          }
        }}
        className={[
          "h-9 w-full rounded-md border px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400",
          invalidAno ? "border-rose-300 bg-rose-50" : "border-zinc-200",
        ].join(" ")}
        placeholder="Número/Ano (ex.: 123/2024)"
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalidAno}
        title={invalidAno ? "Ano inválido. Informe 4 dígitos (ex.: 2024)." : undefined}
      />
    </>
  );
}

