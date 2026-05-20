import { digitsOnly, normalizeName, normalizeUf } from "../normalize";
import type {
  GlobalSearchPermissions,
  GlobalSearchSearchParams,
  GlobalSearchTabKey,
  ParsedGlobalSearchQuery,
} from "./globalSearchTypes";

export function pickGlobalSearchTab(input: string | undefined): GlobalSearchTabKey {
  switch ((input ?? "").toLowerCase()) {
    case "processos":
      return "processos";
    case "atos":
      return "atos";
    case "eventos":
      return "eventos";
    case "documentos":
      return "documentos";
    case "instituicoes":
    default:
      return "instituicoes";
  }
}

/** Normaliza query string da busca global (tokens, heurísticas e aba solicitada). */
export function parseGlobalSearchQuery(
  sp: GlobalSearchSearchParams = {},
): ParsedGlobalSearchQuery {
  const qRaw = (sp.q ?? "").trim();
  const tabRaw = (sp.tab ?? "").trim();
  const tab = pickGlobalSearchTab(tabRaw);

  const ufTokenMatch = qRaw.match(/\b([A-Za-z]{2})\b/);
  const ufToken = ufTokenMatch?.[1] ? normalizeUf(ufTokenMatch[1]) : "";
  const qWithoutUf = ufToken
    ? qRaw.replace(new RegExp(`\\b${ufToken}\\b`, "i"), " ").replace(/\s+/g, " ").trim()
    : qRaw;

  const qDigits = qWithoutUf ? digitsOnly(qWithoutUf) : "";
  const cnpjTokenMatch = qWithoutUf.match(/\b(\d{14})\b/);
  const cnpjToken = cnpjTokenMatch?.[1] ?? "";
  const qIsCnpj = qDigits.length === 14 || cnpjToken.length === 14;
  const qNorm = qWithoutUf && !qIsCnpj ? normalizeName(qWithoutUf) : "";
  const qTerms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];

  const procPattern = qWithoutUf.match(/^\s*(\d+)\s*[/\-]\s*(\d{4})\s*$/);
  const procNumero = procPattern?.[1] ? digitsOnly(procPattern[1]) : "";
  const procAno = procPattern?.[2] ? Number.parseInt(procPattern[2], 10) : null;
  const procAnoOk = typeof procAno === "number" && Number.isFinite(procAno) ? procAno : null;
  const qMaybeNumero = qDigits.length >= 3 && qDigits.length <= 10 ? qDigits : "";
  const canTextSearch = qWithoutUf.length >= 3 && !qIsCnpj;

  const yearMatch = qWithoutUf.match(/\b((?:19|20)\d{2})\b/);
  const yearToken = yearMatch?.[1] ? Number.parseInt(yearMatch[1], 10) : null;
  const yearTokenOk = typeof yearToken === "number" && Number.isFinite(yearToken) ? yearToken : null;

  const numYearSplit = qWithoutUf.match(/^\s*(\d{3,10})\s+((?:19|20)\d{2})\s*$/);
  const procNumeroToken = numYearSplit?.[1] ? digitsOnly(numYearSplit[1]) : "";
  const procAnoToken = numYearSplit?.[2] ? Number.parseInt(numYearSplit[2], 10) : null;
  const procAnoTokenOk =
    typeof procAnoToken === "number" && Number.isFinite(procAnoToken) ? procAnoToken : null;

  const atoTipoNumPattern = qWithoutUf.match(
    /^\s*(PARECER|RESOLUCAO|PORTARIA|OUTRO)\s+([0-9.\-\/]+)\s*$/i,
  );
  const atoTipoFromQuery = atoTipoNumPattern?.[1]
    ? atoTipoNumPattern[1].toUpperCase()
    : "";
  const atoNumeroFromQuery = atoTipoNumPattern?.[2]
    ? atoTipoNumPattern[2].trim()
    : "";

  const docTypePattern = qWithoutUf.match(
    /^\s*(OFICIO|PARECER|RESOLUCAO|OUTRO)\s*(.*)$/i,
  );
  const docTipoFromQuery = docTypePattern?.[1] ? docTypePattern[1].toUpperCase() : "";
  const docTermFromQuery = docTypePattern?.[2] ? docTypePattern[2].trim() : "";

  return {
    qRaw,
    tabRaw,
    tab,
    ufToken,
    qWithoutUf,
    qDigits,
    cnpjToken,
    qIsCnpj,
    qNorm,
    qTerms,
    procNumero,
    procAnoOk,
    qMaybeNumero,
    canTextSearch,
    yearTokenOk,
    procNumeroToken,
    procAnoTokenOk,
    atoTipoFromQuery,
    atoNumeroFromQuery,
    docTipoFromQuery,
    docTermFromQuery,
    hasQuery: qRaw.length > 0,
  };
}

export function isTabAllowedForPermissions(
  tab: GlobalSearchTabKey,
  permissions: GlobalSearchPermissions,
): boolean {
  return (
    (tab === "instituicoes" && permissions.canInst) ||
    (tab === "processos" && permissions.canProc) ||
    (tab === "atos" && permissions.canReg) ||
    (tab === "eventos" && permissions.canReg) ||
    (tab === "documentos" && permissions.canDocs)
  );
}

/** Aba efetiva: respeita `tab` explícita quando permitida; senão heurística automática. */
export function resolveGlobalSearchEffectiveTab(
  query: ParsedGlobalSearchQuery,
  permissions: GlobalSearchPermissions,
): GlobalSearchTabKey {
  const { tab, tabRaw, hasQuery } = query;
  const { canInst, canProc, canReg, canDocs } = permissions;

  const autoTab: GlobalSearchTabKey = (() => {
    if (!hasQuery) {
      return canInst
        ? "instituicoes"
        : canProc
          ? "processos"
          : canReg
            ? "atos"
            : "documentos";
    }

    if (canProc && query.procNumero && query.procAnoOk) return "processos";
    if (canProc && query.procNumeroToken && query.procAnoTokenOk) return "processos";
    if (canProc && (query.cnpjToken || query.qDigits.length === 14) && query.yearTokenOk) {
      return "processos";
    }
    if (canReg && query.atoTipoFromQuery && query.atoNumeroFromQuery) return "atos";
    if (canDocs && query.docTipoFromQuery) return "documentos";
    if (canDocs && query.canTextSearch) return "documentos";
    if (canInst) return "instituicoes";
    if (canProc) return "processos";
    if (canReg) return "atos";
    return "documentos";
  })();

  if (!tabRaw) return autoTab;
  return isTabAllowedForPermissions(tab, permissions) ? tab : autoTab;
}

export type GlobalSearchWhereClauses = {
  instWhere: Record<string, unknown>;
  procWhere: Record<string, unknown>;
  atoWhere: Record<string, unknown>;
  eventoWhere: Record<string, unknown>;
  docWhere: Record<string, unknown>;
};

/** Monta os filtros Prisma compartilhados entre contagens e resultados por aba. */
export function buildGlobalSearchWhereClauses(
  query: ParsedGlobalSearchQuery,
): GlobalSearchWhereClauses {
  const {
    qIsCnpj,
    cnpjToken,
    qDigits,
    qTerms,
    ufToken,
    procNumero,
    procAnoOk,
    procNumeroToken,
    procAnoTokenOk,
    qMaybeNumero,
    canTextSearch,
    qWithoutUf,
    yearTokenOk,
    atoTipoFromQuery,
    atoNumeroFromQuery,
    docTipoFromQuery,
    docTermFromQuery,
  } = query;

  const instWhere = {
    deletedAt: null,
    ...(qIsCnpj
      ? { cnpj: cnpjToken || qDigits }
      : qTerms.length
        ? { AND: qTerms.map((t) => ({ nomeNormalizado: { contains: t } })) }
        : {}),
    ...(ufToken ? { uf: ufToken } : {}),
  };

  const instituicaoClause =
    qIsCnpj || qTerms.length || ufToken
      ? {
          instituicao: {
            deletedAt: null,
            ...(qIsCnpj
              ? { cnpj: cnpjToken || qDigits }
              : { AND: qTerms.map((t) => ({ nomeNormalizado: { contains: t } })) }),
            ...(ufToken ? { uf: ufToken } : {}),
          },
        }
      : null;

  const cnpjAnoClause =
    (cnpjToken || qDigits.length === 14) && yearTokenOk
      ? {
          instituicao: {
            deletedAt: null,
            cnpj: cnpjToken || qDigits,
            ...(ufToken ? { uf: ufToken } : {}),
          },
          ano: yearTokenOk,
        }
      : null;

  const procNumeroAnoClause =
    procNumero && procAnoOk
      ? {
          AND: [
            { numero: { contains: procNumero, mode: "insensitive" as const } },
            { ano: procAnoOk },
          ],
        }
      : procNumeroToken && procAnoTokenOk
        ? {
            AND: [
              {
                numero: { contains: procNumeroToken, mode: "insensitive" as const },
              },
              { ano: procAnoTokenOk },
            ],
          }
        : qMaybeNumero
          ? { numero: { contains: qMaybeNumero, mode: "insensitive" as const } }
          : null;

  const procAssuntoClause = canTextSearch
    ? { assunto: { contains: qWithoutUf, mode: "insensitive" as const } }
    : null;

  const docTipoClause = docTipoFromQuery
    ? { tipoDocumento: { codigo: docTipoFromQuery as never } }
    : null;

  const docTextClause = (() => {
    if (!canTextSearch) return null;
    const term = docTipoFromQuery ? docTermFromQuery : qWithoutUf;
    if (!term || term.length < 3) return null;
    return {
      OR: [
        { titulo: { contains: term, mode: "insensitive" as const } },
        { textoExtraido: { contains: term, mode: "insensitive" as const } },
      ],
    };
  })();

  const procWhere = {
    deletedAt: null,
    ...(instituicaoClause || procNumeroAnoClause || procAssuntoClause || cnpjAnoClause
      ? {
          OR: [
            ...(instituicaoClause ? [instituicaoClause] : []),
            ...(procNumeroAnoClause ? [procNumeroAnoClause] : []),
            ...(procAssuntoClause ? [procAssuntoClause] : []),
            ...(cnpjAnoClause ? [cnpjAnoClause] : []),
          ],
        }
      : {}),
  };

  const atoWhere = {
    deletedAt: null,
    ...(instituicaoClause ||
    (qMaybeNumero && !qIsCnpj) ||
    (atoTipoFromQuery && atoNumeroFromQuery)
      ? {
          OR: [
            ...(instituicaoClause ? [instituicaoClause] : []),
            ...(qMaybeNumero
              ? [{ numero: { contains: qMaybeNumero, mode: "insensitive" as const } }]
              : []),
            ...(atoTipoFromQuery && atoNumeroFromQuery
              ? [
                  {
                    AND: [
                      { tipo: atoTipoFromQuery as never },
                      {
                        numero: {
                          contains: atoNumeroFromQuery,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      : {}),
  };

  const eventoWhere = {
    deletedAt: null,
    ...(instituicaoClause ? instituicaoClause : {}),
    ...(canTextSearch
      ? { descricao: { contains: qWithoutUf, mode: "insensitive" as const } }
      : {}),
  };

  const docWhere = {
    deletedAt: null,
    ...(instituicaoClause ? instituicaoClause : {}),
    ...(docTipoClause ? docTipoClause : {}),
    ...(docTextClause ? docTextClause : {}),
  };

  return { instWhere, procWhere, atoWhere, eventoWhere, docWhere };
}

export function buildGlobalSearchQueryString(
  query: ParsedGlobalSearchQuery,
  tab?: GlobalSearchTabKey,
): URLSearchParams {
  const qs = new URLSearchParams();
  if (query.qRaw) qs.set("q", query.qRaw);
  if (tab) qs.set("tab", tab);
  return qs;
}

export function buildGlobalSearchTabHref(
  query: ParsedGlobalSearchQuery,
  tab: GlobalSearchTabKey,
): string {
  const p = buildGlobalSearchQueryString(query);
  p.set("tab", tab);
  return `/busca?${p.toString()}`;
}

export function buildGlobalSearchReturnTo(
  query: ParsedGlobalSearchQuery,
  effectiveTab: GlobalSearchTabKey,
): string {
  const p = buildGlobalSearchQueryString(query);
  p.set("tab", effectiveTab);
  return `/busca?${p.toString()}`;
}
