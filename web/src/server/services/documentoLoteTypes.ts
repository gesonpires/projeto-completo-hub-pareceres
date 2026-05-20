export type DocumentoLoteResult =
  | { ok: true; instituicaoId: string; successMessage: string }
  | { ok: false; error: string };

export type DocumentoLoteActor = {
  userId: string;
};

export type DocumentoLoteUploadFiles = {
  zipFile: File | null;
  files: File[];
};
