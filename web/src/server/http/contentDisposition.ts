export function asciiFallbackFilename(input: string, fallback: string) {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return base.length > 0 ? base : fallback;
}

export function attachmentContentDisposition(originalName: string, fallbackBase: string) {
  const ascii = asciiFallbackFilename(originalName, fallbackBase);
  const utf8 = encodeURIComponent(originalName);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

