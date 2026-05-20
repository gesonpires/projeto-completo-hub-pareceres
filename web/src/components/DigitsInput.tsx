"use client";

import { useId, useState } from "react";
import { digitsOnly } from "@/server/normalize";

export function DigitsInput(props: {
  id?: string;
  name: string;
  defaultValue?: string | number | null;
  className?: string;
  placeholder?: string;
  maxDigits?: number;
  exactLength?: number;
  invalidMessage?: string;
}) {
  const reactId = useId();
  const id = props.id ?? `digits-${reactId}`;

  const [value, setValue] = useState(() => {
    const d = digitsOnly(String(props.defaultValue ?? ""));
    return (props.maxDigits ? d.slice(0, props.maxDigits) : d) || "";
  });

  return (
    <input
      id={id}
      name={props.name}
      value={value}
      onChange={(e) => {
        const d = digitsOnly(e.target.value);
        const next = props.maxDigits ? d.slice(0, props.maxDigits) : d;
        setValue(next);

        if (props.exactLength && next.length > 0 && next.length !== props.exactLength) {
          e.target.setCustomValidity(
            props.invalidMessage ??
              `Informe exatamente ${props.exactLength} dígitos.`,
          );
        } else {
          e.target.setCustomValidity("");
        }
      }}
      className={props.className}
      placeholder={props.placeholder}
      inputMode="numeric"
      autoComplete="off"
    />
  );
}

