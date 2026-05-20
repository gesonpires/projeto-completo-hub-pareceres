import type {
  InstitutionDetailSearchParams,
  ParsedInstitutionDetailQuery,
} from "./institutionDetailTypes";
import {
  INSTITUTION_DETAIL_DEFAULT_LIMIT,
  INSTITUTION_DETAIL_MAX_LIMIT,
  INSTITUTION_DETAIL_MIN_LIMIT,
} from "./institutionDetailTypes";

export function parseInstitutionDetailQuery(
  sp: InstitutionDetailSearchParams = {},
  _instituicaoId: string,
): ParsedInstitutionDetailQuery {
  const showDeleted = sp.showDeleted === "1";
  const limitRaw = (sp.limit ?? "").trim();
  const limit = Math.min(
    INSTITUTION_DETAIL_MAX_LIMIT,
    Math.max(
      INSTITUTION_DETAIL_MIN_LIMIT,
      Number.parseInt(limitRaw || String(INSTITUTION_DETAIL_DEFAULT_LIMIT), 10) ||
        INSTITUTION_DETAIL_DEFAULT_LIMIT,
    ),
  );
  const returnToRaw = (sp.returnTo ?? "").trim();
  const returnTo =
    returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/instituicoes";

  return { showDeleted, limit, returnToRaw, returnTo };
}

/** URL de retorno dentro da própria ficha (preserva filtros da página). */
export function buildInstitutionDetailReturnTo(
  instituicaoId: string,
  query: ParsedInstitutionDetailQuery,
): string {
  const p = new URLSearchParams();
  if (query.showDeleted) p.set("showDeleted", "1");
  if (query.limit !== INSTITUTION_DETAIL_DEFAULT_LIMIT) {
    p.set("limit", String(query.limit));
  }
  if (query.returnToRaw && query.returnToRaw.startsWith("/")) {
    p.set("returnTo", query.returnToRaw);
  }
  const qs = p.toString();
  return qs ? `/instituicoes/${instituicaoId}?${qs}` : `/instituicoes/${instituicaoId}`;
}

export function buildInstitutionDetailDismissHref(
  instituicaoId: string,
  showDeleted: boolean,
): string {
  return `/instituicoes/${instituicaoId}${showDeleted ? "?showDeleted=1" : ""}`;
}
