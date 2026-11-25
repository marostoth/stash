import {
  getLanguageModel,
  normalizeAvailability,
  stripJsonFences,
} from '@/lib/categorizer/nano-helpers';
import type {
  CategorizationSuggestion,
  CategorizationTarget,
  LanguageModelAvailabilityOptions,
  LanguageModelSession,
  NanoAvailabilityStatus,
} from '@/lib/categorizer/types';
import type { Collection } from '@/lib/types/stash';
import { normalizeTags } from '@/lib/utils/url';

export const NANO_AVAILABILITY_OPTIONS: LanguageModelAvailabilityOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

/**
 * Forces topic-first structured reasoning inside strict JSON:
 * 1. tags + summaryNote (analyze the page)
 * 2. idealCategory (name the true 1-3 word topic independently of user collections)
 * 3. matchesExisting + existingCollection (only match if idealCategory genuinely
 *    belongs in one of existingCollections; prevents small-model forced-choice bias)
 */
export const NANO_RESPONSE_CONSTRAINT: Record<string, unknown> = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
    },
    summaryNote: { type: 'string', maxLength: 100 },
    idealCategory: { type: 'string', maxLength: 48 },
    matchesExisting: { type: 'boolean' },
    existingCollection: { type: 'string', maxLength: 48 },
  },
  required: [
    'tags',
    'summaryNote',
    'idealCategory',
    'matchesExisting',
    'existingCollection',
  ],
};

const NANO_INITIAL_PROMPTS: Array<{
  role: 'system' | 'user' | 'assistant';
  content: string;
}> = [
  {
    role: 'system',
    content: [
      'You categorize web bookmarks into collections and return strict JSON.',
      'Follow these steps in order:',
      '1. Output 1-3 short lowercase kebab-case "tags" and a concise "summaryNote" (<=100 chars).',
      '2. Output "idealCategory": the true 1-3 word category for this page, ignoring existingCollections (e.g. "3D Printing", "Writing", "Dev", "Trading").',
      '3. Check if "idealCategory" directly belongs to one of "existingCollections":',
      '   - Only set "matchesExisting": true and "existingCollection" to that exact collection name when the topics clearly match (e.g. coding/extensions -> "Dev", stocks/futures -> "Trading").',
      '   - Shopping/product stores (like a 3D printer store) are NOT "Trading". Writing tools are NOT "Trading" or "Dev".',
      '   - If no existing collection clearly matches (or existingCollections is empty), set "matchesExisting": false and "existingCollection": "".',
    ].join('\n'),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://developer.chrome.com/docs/extensions',
      title: 'Build extensions with coding agents | Chrome for Developers',
      existingCollections: [{ name: 'Dev' }, { name: 'Trading' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['chrome', 'extensions', 'dev'],
      summaryNote: 'Chrome extension development guide for coding agents',
      idealCategory: 'Dev',
      matchesExisting: true,
      existingCollection: 'Dev',
    }),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://uk.store.bambulab.com/products/a1',
      title: 'Bambu Lab A1 | Multi-color 3D Printer | Bambu Lab UK Store',
      existingCollections: [{ name: 'Trading' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['3d-printing', 'bambu-lab', 'printer'],
      summaryNote: 'Bambu Lab A1 multi-color 3D printer product page',
      idealCategory: '3D Printing',
      matchesExisting: false,
      existingCollection: '',
    }),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://app.grammarly.com',
      title: 'Grammarly',
      existingCollections: [{ name: 'Trading' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['writing', 'grammar', 'editor'],
      summaryNote: 'Online writing and grammar assistant',
      idealCategory: 'Writing',
      matchesExisting: false,
      existingCollection: '',
    }),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://www.cmegroup.com',
      title: 'Futures & Options Trading for Risk Management - CME Group',
      existingCollections: [{ name: 'Trading' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['trading', 'futures', 'options'],
      summaryNote: 'CME Group futures and options trading platform',
      idealCategory: 'Trading',
      matchesExisting: true,
      existingCollection: 'Trading',
    }),
  },
];

const SENTINEL_VALUES = new Set([
  '',
  'none',
  'null',
  'undefined',
  'n/a',
  'new',
]);

interface RawNanoResponse {
  idealCategory?: unknown;
  matchesExisting?: unknown;
  existingCollection?: unknown;
  matchType?: unknown;
  collectionName?: unknown;
  collectionId?: unknown;
  suggestedNewCollection?: unknown;
  tags?: unknown;
  summaryNote?: unknown;
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (SENTINEL_VALUES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function parseNanoResponse(
  rawText: string,
  collections: readonly Collection[],
): CategorizationSuggestion | null {
  let parsed: RawNanoResponse;
  try {
    parsed = JSON.parse(stripJsonFences(rawText)) as RawNanoResponse;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const nonSessionCollections = collections.filter((c) => !c.isSession);
  const validById = new Map(nonSessionCollections.map((c) => [c.id, c]));
  const validByLowerName = new Map(
    nonSessionCollections.map((c) => [c.name.trim().toLowerCase(), c]),
  );

  let collectionId: string | undefined;
  let suggestedNewCollection: string | undefined;

  const idealCategory = cleanOptionalString(parsed.idealCategory);
  const existingCollectionName = cleanOptionalString(parsed.existingCollection);

  if (
    idealCategory !== undefined ||
    typeof parsed.matchesExisting === 'boolean'
  ) {
    if (parsed.matchesExisting === true && existingCollectionName) {
      const matched = validByLowerName.get(
        existingCollectionName.toLowerCase(),
      );
      if (matched) {
        collectionId = matched.id;
      }
    }

    if (!collectionId && idealCategory) {
      const exactExisting = validByLowerName.get(idealCategory.toLowerCase());
      if (exactExisting) {
        collectionId = exactExisting.id;
      } else {
        suggestedNewCollection = idealCategory.slice(0, 48);
      }
    }
  } else {
    // Fallback support for legacy { matchType, collectionName } or { collectionId } shapes
    const rawCollectionName = cleanOptionalString(parsed.collectionName);
    if (rawCollectionName) {
      const existingByName = validByLowerName.get(
        rawCollectionName.toLowerCase(),
      );
      if (existingByName) {
        collectionId = existingByName.id;
      } else if (
        parsed.matchType === 'new' ||
        !validById.has(rawCollectionName)
      ) {
        suggestedNewCollection = rawCollectionName.slice(0, 48);
      }
    } else {
      const rawCollectionId = cleanOptionalString(parsed.collectionId);
      const rawSuggestedNew = cleanOptionalString(
        parsed.suggestedNewCollection,
      );

      if (rawCollectionId) {
        collectionId = validById.has(rawCollectionId)
          ? rawCollectionId
          : validByLowerName.get(rawCollectionId.toLowerCase())?.id;
      }
      if (rawSuggestedNew) {
        const existingMatch = validByLowerName.get(
          rawSuggestedNew.toLowerCase(),
        );
        if (existingMatch && !collectionId) {
          collectionId = existingMatch.id;
        } else if (!collectionId) {
          suggestedNewCollection = rawSuggestedNew.slice(0, 48);
        }
      }
    }
  }

  const rawTags = Array.isArray(parsed.tags)
    ? parsed.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().replace(/\s+/g, '-'))
    : [];
  const tags = normalizeTags(rawTags).slice(0, 3);

  const summaryNote = cleanOptionalString(parsed.summaryNote)?.slice(0, 100);

  return {
    source: 'nano',
    collectionId,
    suggestedNewCollection,
    tags,
    summaryNote,
  };
}

export async function checkNanoAvailability(): Promise<NanoAvailabilityStatus> {
  const lm = getLanguageModel();
  if (!lm) return 'unavailable';

  try {
    const status = await lm.availability(NANO_AVAILABILITY_OPTIONS);
    return normalizeAvailability(status);
  } catch {
    return 'unavailable';
  }
}

/**
 * Triggers on-device model download. Must ONLY be invoked inside an explicit
 * user gesture (e.g. clicking "Enable On-Device AI" in Settings).
 */
export async function downloadNanoModel(
  onProgress?: (percent: number) => void,
): Promise<boolean> {
  const lm = getLanguageModel();
  if (!lm) return false;

  let session: LanguageModelSession | null = null;
  try {
    session = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          const ratio =
            event.total && event.total > 0
              ? event.loaded / event.total
              : event.loaded;
          const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
          onProgress?.(pct);
        });
      },
    });
    onProgress?.(100);
    return true;
  } catch {
    return false;
  } finally {
    session?.destroy();
  }
}

export async function categorizeWithNano(
  target: CategorizationTarget,
  collections: readonly Collection[],
): Promise<CategorizationSuggestion | null> {
  const lm = getLanguageModel();
  if (!lm) return null;

  const status = await checkNanoAvailability();
  if (status !== 'available') {
    return null;
  }

  let session: LanguageModelSession | null = null;
  try {
    session = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      initialPrompts: NANO_INITIAL_PROMPTS,
    });

    const payload = {
      url: target.url,
      title: target.title,
      existingCollections: collections
        .filter((col) => !col.isSession)
        .map((col) => ({
          name: col.name,
          ...(col.description
            ? { description: col.description.slice(0, 60) }
            : {}),
        })),
    };

    const rawText = await session.prompt(JSON.stringify(payload), {
      responseConstraint: NANO_RESPONSE_CONSTRAINT,
    });

    return parseNanoResponse(rawText, collections);
  } catch {
    return null;
  } finally {
    session?.destroy();
  }
}
