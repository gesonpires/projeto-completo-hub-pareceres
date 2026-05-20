"use client";

import { useEffect } from "react";

type Props = {
  prefix?: string;
  durationMs?: number;
};

function applyHighlight(hash: string, durationMs: number) {
  if (!hash || !hash.startsWith("#")) return;
  const id = hash.slice(1);
  if (!id) return;

  const el = document.getElementById(id);
  if (!el) return;

  // Realce visual temporário do item ancorado.
  const classes = [
    "ring-2",
    "ring-amber-400",
    "bg-amber-50",
    "border-amber-200",
  ];
  for (const c of classes) el.classList.add(c);

  window.setTimeout(() => {
    for (const c of classes) el.classList.remove(c);
  }, durationMs);
}

export function AnchorHighlight({ prefix = "#t-", durationMs = 2200 }: Props) {
  useEffect(() => {
    const run = () => {
      const h = window.location.hash || "";
      if (!h.startsWith(prefix)) return;
      applyHighlight(h, durationMs);
    };

    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, [prefix, durationMs]);

  return null;
}

