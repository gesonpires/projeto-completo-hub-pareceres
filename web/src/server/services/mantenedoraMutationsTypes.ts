export type MantenedoraMutationResult =
  | { ok: true; mantenedoraId: string; redirectSuffix?: string }
  | { ok: false; error: string };

export type MutationActor = {
  userId: string;
};
