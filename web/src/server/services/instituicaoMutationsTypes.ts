export type InstituicaoMutationResult =
  | { ok: true; instituicaoId: string; redirectSuffix?: string }
  | { ok: false; error: string };

export type MutationActor = {
  userId: string;
};
