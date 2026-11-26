import type { ReactNode } from 'react';

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits text into matched and unmatched segments for case-insensitive search
 * highlighting (supports multi-word whitespace-separated terms).
 */
export function splitHighlightSegments(
  text: string,
  rawQuery: string,
): HighlightSegment[] {
  const trimmed = rawQuery.trim();
  if (!trimmed || !text) return [{ text, match: false }];

  const tokens = trimmed
    .split(/\s+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return [{ text, match: false }];

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return [{ text, match: false }];

  const lowerTokens = new Set(tokens.map((t) => t.toLowerCase()));
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: lowerTokens.has(part.toLowerCase()),
    }));
}

interface HighlightTextProps {
  text: string;
  query: string;
}

export function HighlightText({ text, query }: HighlightTextProps): ReactNode {
  if (!query.trim()) return text;
  const segments = splitHighlightSegments(text, query);
  if (segments.length === 1 && !segments[0]?.match) return text;

  let offset = 0;
  return segments.map((seg) => {
    const start = offset;
    offset += seg.text.length;
    return seg.match ? (
      <mark
        key={`${start}-${seg.text}`}
        className="stash-match-highlight rounded-[3px] bg-accent/22 px-0.5 text-fg ring-1 ring-accent/35"
      >
        {seg.text}
      </mark>
    ) : (
      seg.text
    );
  });
}
