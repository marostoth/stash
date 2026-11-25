import { findBestExistingCollectionMatch } from '@/lib/categorizer/collection-matcher';
import {
  getLanguageModel,
  normalizeAvailability,
  resolveDeterministicSampling,
  stripJsonFences,
} from '@/lib/categorizer/nano-helpers';

export {
  acquireWarmNanoSession,
  disposeWarmNanoSession,
  prewarmNanoCategorizer,
  releaseWarmNanoSession,
} from '@/lib/categorizer/nano-prewarm';
export { findBestExistingCollectionMatch };

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

/**
 * Generalized few-shot examples using distinct non-colliding sample names
 * ("Cooking", "Travel", "Software", "Fitness") so Nano does not leak common
 * dev/finance names into unrelated user libraries.
 */
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
      '2. Output "idealCategory": the true 1-3 word topic for this page, independent of existingCollections (e.g., "Cooking", "Travel", "Fitness", "Photography").',
      '   - If the page is a generic inbox, social home feed, search homepage, or temporary utility tab (e.g., Gmail inbox, YouTube home feed, Google search) that does not belong in a bookmark topic, set "matchesExisting": false, "existingCollection": "", and "idealCategory": "".',
      '3. Check if the page clearly belongs in one of "existingCollections":',
      '   - Only set "matchesExisting": true and "existingCollection" to that exact existing collection name when the topics clearly match.',
      '   - Do NOT force unrelated sites into an existing collection.',
      '   - If no existing collection clearly matches (or existingCollections is empty), set "matchesExisting": false and "existingCollection": "".',
    ].join('\n'),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://www.seriouseats.com/sourdough-bread-guide',
      title: 'The Complete Sourdough Bread Guide | Serious Eats',
      existingCollections: [{ name: 'Cooking' }, { name: 'Travel' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['sourdough', 'baking', 'bread'],
      summaryNote: 'Step-by-step guide to baking sourdough bread',
      idealCategory: 'Cooking',
      matchesExisting: true,
      existingCollection: 'Cooking',
    }),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://www.alltrails.com/trail/alps-ridge',
      title: 'Alps Ridge Loop Trail Map & Photos | AllTrails',
      existingCollections: [{ name: 'Software' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['hiking', 'trails', 'outdoors'],
      summaryNote: 'Trail map and route photos for Alps Ridge Loop',
      idealCategory: 'Travel',
      matchesExisting: false,
      existingCollection: '',
    }),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://www.strongerbyscience.com/squat-guide',
      title: 'How to Squat: The Definitive Guide',
      existingCollections: [{ name: 'Cooking' }, { name: 'Fitness' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['squat', 'strength', 'training'],
      summaryNote: 'Comprehensive biomechanics and form guide for squats',
      idealCategory: 'Fitness',
      matchesExisting: true,
      existingCollection: 'Fitness',
    }),
  },
  {
    role: 'user',
    content: JSON.stringify({
      url: 'https://mail.google.com/mail/u/0/#inbox',
      title: 'Inbox (12) - Gmail',
      existingCollections: [{ name: 'Cooking' }, { name: 'Software' }],
    }),
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      tags: ['email', 'inbox'],
      summaryNote: 'Personal email inbox',
      idealCategory: '',
      matchesExisting: false,
      existingCollection: '',
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
  'uncategorized',
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

function buildPayload(
  target: CategorizationTarget,
  collections: readonly Collection[],
): string {
  return JSON.stringify({
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
  });
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

  let collectionId: string | undefined;
  let suggestedNewCollection: string | undefined;

  const idealCategory = cleanOptionalString(parsed.idealCategory);
  const existingCollectionName = cleanOptionalString(parsed.existingCollection);

  if (
    idealCategory !== undefined ||
    typeof parsed.matchesExisting === 'boolean'
  ) {
    if (parsed.matchesExisting === true && existingCollectionName) {
      const matched = findBestExistingCollectionMatch(
        existingCollectionName,
        nonSessionCollections,
      );
      if (matched) {
        collectionId = matched.id;
      }
    }

    if (!collectionId && idealCategory) {
      const matchedExisting = findBestExistingCollectionMatch(
        idealCategory,
        nonSessionCollections,
      );
      if (matchedExisting) {
        collectionId = matchedExisting.id;
      } else {
        suggestedNewCollection = idealCategory.slice(0, 48);
      }
    }
  } else {
    // Fallback support for legacy { matchType, collectionName } or { collectionId } shapes
    const rawCollectionName = cleanOptionalString(parsed.collectionName);
    if (rawCollectionName) {
      const existingByName = findBestExistingCollectionMatch(
        rawCollectionName,
        nonSessionCollections,
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
          : findBestExistingCollectionMatch(
              rawCollectionId,
              nonSessionCollections,
            )?.id;
      }
      if (rawSuggestedNew) {
        const existingMatch = findBestExistingCollectionMatch(
          rawSuggestedNew,
          nonSessionCollections,
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

const NANO_ITEM_TIMEOUT_MS = 12_000;

export interface NanoCategorizerSession {
  categorize: (
    target: CategorizationTarget,
    collections: readonly Collection[],
    signal?: AbortSignal,
  ) => Promise<CategorizationSuggestion | null>;
  destroy: () => void;
}

/**
 * Creates ONE reusable base LanguageModel session pre-warmed with few-shot
 * instructions and deterministic sampling, cloning per link for fast, isolated
 * batch categorization during Auto-Categorize triage.
 */
export async function createNanoCategorizerSession(
  signal?: AbortSignal,
): Promise<NanoCategorizerSession | null> {
  if (signal?.aborted) return null;
  const lm = getLanguageModel();
  if (!lm) return null;

  const status = await checkNanoAvailability();
  if (status !== 'available') return null;

  let baseSession: LanguageModelSession | null = null;
  try {
    const sampling = await resolveDeterministicSampling(lm);
    baseSession = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      signal,
      initialPrompts: NANO_INITIAL_PROMPTS,
    });
  } catch {
    baseSession?.destroy();
    return null;
  }

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    baseSession?.destroy();
    baseSession = null;
  };

  return {
    async categorize(target, collections, itemSignal) {
      if (destroyed || !baseSession || itemSignal?.aborted) return null;
      let itemSession: LanguageModelSession | null = null;
      let isClone = false;

      const controller = new AbortController();
      const onOuterAbort = () => controller.abort();
      itemSignal?.addEventListener('abort', onOuterAbort, { once: true });
      const timeoutId = setTimeout(
        () => controller.abort(),
        NANO_ITEM_TIMEOUT_MS,
      );

      try {
        if (typeof baseSession.clone === 'function') {
          itemSession = await baseSession.clone({ signal: controller.signal });
          isClone = true;
        } else {
          itemSession = baseSession;
        }

        const rawText = await itemSession.prompt(
          buildPayload(target, collections),
          {
            responseConstraint: NANO_RESPONSE_CONSTRAINT,
            signal: controller.signal,
          },
        );
        return parseNanoResponse(rawText, collections);
      } catch {
        return null;
      } finally {
        clearTimeout(timeoutId);
        itemSignal?.removeEventListener('abort', onOuterAbort);
        if (isClone) {
          itemSession?.destroy();
        }
      }
    },
    destroy,
  };
}

export async function categorizeWithNano(
  target: CategorizationTarget,
  collections: readonly Collection[],
  signal?: AbortSignal,
): Promise<CategorizationSuggestion | null> {
  const session = await createNanoCategorizerSession(signal);
  if (!session) return null;

  try {
    return await session.categorize(target, collections, signal);
  } finally {
    session.destroy();
  }
}
