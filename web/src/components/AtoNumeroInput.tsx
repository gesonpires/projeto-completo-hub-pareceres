"use client";

import { useId, useMemo, useState } from "react";
import { digitsOnly } from "@/server/normalize";

function normalizeAtoNumero(raw: string) {
  const v = raw.trim();
  if (!v) return "";

  // Se vier algo como "123/2024" (ou com texto), tenta capturar 1º e 2º grupos numéricos.
  const groups = v.match(/\d+/g) ?? [];
  if (groups.length === 0) return "";

  const first = groups[0] ?? "";
  const second = groups[1] ?? "";

  // Heurística simples: se houver 2º grupo e parecer ano (2-4 dígitos), mantém "N/ANO".
  if (second && second.length >= 2 && second.length <= 4) {
    return `${digitsOnly(first)}/${digitsOnly(second)}`.slice(0, 20);
  }

  return digitsOnly(first).slice(0, 20);
}

export function AtoNumeroInput(props: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  className?: string;
  placeholder?: string;
}) {
  const reactId = useId();
  const id = props.id ?? `ato-numero-${reactId}`;

  const [value, setValue] = useState(() => normalizeAtoNumero(String(props.defaultValue ?? "")));
  const invalid = useMemo(() => {
    if (!value) return false;
    return !/^\d+(\/\d{2,4})?$/.test(value);
  }, [value]);

  return (
    <input
      id={id}
      name={props.name}
      value={value}
      onChange={(e) => {
        const next = normalizeAtoNumero(e.target.value);
        setValue(next);
        if (e.target.value.trim().length > 0 && !/^\d+(\/\d{2,4})?$/.test(next)) {
          e.target.setCustomValidity("Número inválido. Use apenas dígitos (opcional /ano).");
        } else {
          e.target.setCustomValidity("");
        }
      }}
      className={[
        props.className ?? "",
        invalid ? "border-rose-300 bg-rose-50" : "",
      ].join(" ")}
      placeholder={props.placeholder ?? "Número (ex.: 123/2024)"}
      inputMode="numeric"
      autoComplete="off"
      aria-invalid={invalid}
      title={invalid ? "Número inválido. Use apenas dígitos (opcional /ano)." : undefined}
    />
  );
}

