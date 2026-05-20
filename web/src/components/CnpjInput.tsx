"use client";

import { useId, useMemo, useState } from "react";
import { digitsOnly, formatCnpj } from "@/server/normalize";

export function CnpjInput(props: {
  id?: string;
  name: string;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
}) {
  const reactId = useId();
  const id = props.id ?? `cnpj-${reactId}`;

  const [digits, setDigits] = useState(() => {
    const d = digitsOnly(props.defaultValue ?? "");
    return d.slice(0, 14);
  });

  const display = useMemo(() => {
    return digits.length === 14 ? formatCnpj(digits) : digits;
  }, [digits]);

  return (
    <input
      id={id}
      name={props.name}
      value={display}
      onChange={(e) => {
        const next = digitsOnly(e.target.value).slice(0, 14);
        setDigits(next);
      }}
      className={props.className}
      placeholder={props.placeholder ?? "Somente números (ou cole com pontuação)"}
      inputMode="numeric"
      autoComplete="off"
    />
  );
}

