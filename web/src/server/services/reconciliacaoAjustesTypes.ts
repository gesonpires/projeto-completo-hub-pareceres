export type ReconciliacaoAjusteResult =
  | { ok: true; loteId: string; okMessage?: string }
  | { ok: false; error: string };

export type ReconciliacaoActor = {
  userId: string;
};
