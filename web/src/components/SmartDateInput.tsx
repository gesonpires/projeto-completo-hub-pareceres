"use client";

import { useId, useMemo, useState } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoToBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function toIsoDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  // YYYY-MM-DD
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY
  m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(v);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (yyyy < 1900 || yyyy > 2100) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  // DDMMAAAA (8 dígitos)
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(v.replace(/\s+/g, ""));
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (yyyy < 1900 || yyyy > 2100) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;
    return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
  }

  return null;
}

export function SmartDateInput(props: {
  id?: string;
  name: string;
  defaultValueIso?: string;
  className?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const reactId = useId();
  const id = props.id ?? `date-${reactId}`;

  const [text, setText] = useState(() => {
    const iso = (props.defaultValueIso ?? "").trim();
    return iso ? isoToBr(iso) : "";
  });

  const parsed = useMemo(() => toIsoDate(text), [text]);
  const iso = parsed ?? "";
  const invalid = text.trim().length > 0 && !parsed;
  const requiredInvalid = Boolean(props.required) && text.trim().length > 0 && !parsed;

  return (
    <>
      <input type="hidden" name={props.name} value={iso} />
      <input
        id={id}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const ok = toIsoDate(next);
          if (next.trim().length > 0 && !ok) {
            e.target.setCustomValidity("Data inválida. Use dd/mm/aaaa.");
          } else {
            e.target.setCustomValidity("");
          }
        }}
        className={[
          props.className ?? "",
          invalid ? "border-rose-300 bg-rose-50" : "",
        ].join(" ")}
        required={props.required}
        placeholder={props.placeholder ?? "dd/mm/aaaa"}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid}
        title={invalid ? "Data inválida. Use dd/mm/aaaa." : undefined}
        // Ajuda leitores de tela a entenderem o motivo da invalidação.
        aria-errormessage={requiredInvalid ? "data-invalida" : undefined}
      />
    </>
  );
}

