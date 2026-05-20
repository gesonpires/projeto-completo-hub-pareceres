import { digitsOnly, isValidCnpj } from "../normalize";

export function validateOptionalCnpj(
  cnpjRaw?: string,
): { ok: true; cnpj: string | null } | { ok: false; error: string } {
  const cnpjDigits = cnpjRaw ? digitsOnly(cnpjRaw) : undefined;
  if (cnpjDigits && cnpjDigits.length > 0 && cnpjDigits.length !== 14) {
    return { ok: false, error: "CNPJ inválido: informe exatamente 14 dígitos." };
  }
  if (cnpjDigits && cnpjDigits.length === 14 && !isValidCnpj(cnpjDigits)) {
    return { ok: false, error: "CNPJ inválido: dígitos verificadores não conferem." };
  }
  return { ok: true, cnpj: cnpjDigits && cnpjDigits.length > 0 ? cnpjDigits : null };
}
