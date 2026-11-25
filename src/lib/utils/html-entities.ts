const MAX_UNICODE_CODE_POINT = 0x10ffff;

function safeFromCodePoint(code: number, fallback: string): string {
  if (!Number.isInteger(code) || code < 0 || code > MAX_UNICODE_CODE_POINT) {
    return fallback;
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/**
 * MV3-service-worker-safe HTML entity decoder (never uses DOMParser/innerHTML).
 * Validates numeric code points within [0, 0x10FFFF] so malformed entities
 * (e.g. `&#99999999;`) never throw RangeError.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      safeFromCodePoint(Number.parseInt(hex, 16), match),
    )
    .replace(/&#(\d+);/g, (match, dec: string) =>
      safeFromCodePoint(Number.parseInt(dec, 10), match),
    );
}
