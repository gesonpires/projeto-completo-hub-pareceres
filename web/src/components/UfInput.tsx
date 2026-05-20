"use client";

import { useId, useMemo, useState } from "react";

function normalizeUf(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

export function UfInput(props: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  className?: string;
  placeholder?: string;
}) {
  const reactId = useId();
  const id = props.id ?? `uf-${reactId}`;

  const [value, setValue] = useState(() => normalizeUf(String(props.defaultValue ?? "")));
  const invalid = useMemo(() => value.length === 1, [value]);

  return (
    <input
      id={id}
      name={props.name}
      value={value}
      onChange={(e) => {
        const next = normalizeUf(e.target.value);
        setValue(next);
        if (next.length === 1) {
          e.target.setCustomValidity("UF inválida. Informe 2 letras (ex.: SC).");
        } else {
          e.target.setCustomValidity("");
        }
      }}
      className={[
        props.className ?? "",
        invalid ? "border-rose-300 bg-rose-50" : "",
      ].join(" ")}
      placeholder={props.placeholder ?? "SC"}
      autoComplete="off"
      aria-invalid={invalid}
      title={invalid ? "UF inválida. Informe 2 letras (ex.: SC)." : undefined}
    />
  );
}

