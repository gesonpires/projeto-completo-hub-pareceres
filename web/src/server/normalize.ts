export function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

export function isValidCnpj(cnpjDigits: string) {
  const cnpj = digitsOnly(cnpjDigits);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const nums = cnpj.split("").map((c) => Number(c));
  if (nums.some((n) => !Number.isFinite(n))) return false;

  const calc = (baseLen: 12 | 13) => {
    const weights =
      baseLen === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += nums[i] * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(12);
  const d2 = calc(13);
  return nums[12] === d1 && nums[13] === d2;
}

export function formatCnpj(cnpjDigits: string) {
  const cnpj = digitsOnly(cnpjDigits);
  if (cnpj.length !== 14) return cnpjDigits;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

export function normalizeMunicipio(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeUf(value: string) {
  const uf = value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  return uf.length === 2 ? uf : "";
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

