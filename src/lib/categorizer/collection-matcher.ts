import type { Collection } from '@/lib/types/stash';

const COLLECTION_STOP_WORDS = new Set([
  'and',
  'the',
  'for',
  'of',
  'in',
  'to',
  'a',
  'an',
  'my',
  'misc',
]);

function tokenizeCollectionName(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 2 && !COLLECTION_STOP_WORDS.has(tok));
}

/**
 * Pure collection matcher reconciling a Nano category label against existing
 * non-session collections:
 * 1. Exact case-insensitive name match
 * 2. Token-subset match where all significant words of `candidateName` appear
 *    as tokens inside an existing collection's name (e.g., "Trading" -> "Finance & Trading",
 *    "Dev" -> "Web Dev", "3D Printing" -> "Hardware & 3D Printing"), returning only
 *    a single unambiguous closest match.
 */
export function findBestExistingCollectionMatch(
  candidateName: string,
  collections: readonly Collection[],
): Collection | undefined {
  const trimmed = candidateName.trim();
  if (!trimmed) return undefined;

  const nonSession = collections.filter((c) => !c.isSession);
  const lower = trimmed.toLowerCase();

  const exact = nonSession.find((c) => c.name.trim().toLowerCase() === lower);
  if (exact) return exact;

  const candidateTokens = Array.from(new Set(tokenizeCollectionName(trimmed)));
  if (candidateTokens.length === 0) return undefined;

  let bestExtraTokens = Number.POSITIVE_INFINITY;
  let bestMatches: Collection[] = [];

  for (const col of nonSession) {
    const colTokenSet = new Set(tokenizeCollectionName(col.name));
    if (colTokenSet.size === 0) continue;

    const allPresent = candidateTokens.every((tok) => colTokenSet.has(tok));
    if (!allPresent) continue;

    const extraTokens = colTokenSet.size - candidateTokens.length;
    if (extraTokens < bestExtraTokens) {
      bestExtraTokens = extraTokens;
      bestMatches = [col];
    } else if (extraTokens === bestExtraTokens) {
      bestMatches.push(col);
    }
  }

  return bestMatches.length === 1 ? bestMatches[0] : undefined;
}
