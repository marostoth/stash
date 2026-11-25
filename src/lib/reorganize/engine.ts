import {
  checkNanoAvailability,
  NANO_AVAILABILITY_OPTIONS,
} from '@/lib/categorizer/nano-engine';
import type {
  LanguageModelAPI,
  LanguageModelSession,
  NanoAvailabilityStatus,
} from '@/lib/categorizer/types';
import {
  buildLibraryDigest,
  type ProposedCategory,
  type RawProposedCategory,
  sanitizeProposedCategories,
  UNCATEGORIZED_CATEGORY_NAME,
} from '@/lib/reorganize/digest';
import { clampDeterministicParams } from '@/lib/tagging/auto-tagger';
import type { LinkItem } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';

const PROPOSE_CATEGORIES_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 40 },
          description: { type: 'string', maxLength: 120 },
        },
        required: ['name', 'description'],
      },
    },
  },
  required: ['categories'],
};

export type ProposeCategoriesResult =
  | { status: 'ok'; categories: ProposedCategory[] }
  | {
      status: 'unavailable';
      availability: NanoAvailabilityStatus;
      reason: string;
    }
  | { status: 'canceled' }
  | { status: 'error'; reason: string };

export interface SortLinksProgress {
  completed: number;
  total: number;
  currentTitle: string;
}

export type SortLinksResult =
  | { status: 'ok'; assignments: Record<string, string> }
  | { status: 'canceled'; assignments: Record<string, string> }
  | {
      status: 'unavailable';
      availability: NanoAvailabilityStatus;
      reason: string;
    }
  | { status: 'error'; reason: string; assignments: Record<string, string> };

function getLanguageModel(): LanguageModelAPI | undefined {
  const globalObj = globalThis as { LanguageModel?: unknown };
  const candidate = globalObj.LanguageModel;
  if (
    candidate &&
    (typeof candidate === 'object' || typeof candidate === 'function') &&
    'availability' in candidate &&
    'create' in candidate &&
    typeof (candidate as LanguageModelAPI).availability === 'function' &&
    typeof (candidate as LanguageModelAPI).create === 'function'
  ) {
    return candidate as LanguageModelAPI;
  }
  return undefined;
}

function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ? fenced[1].trim() : trimmed;
}

async function resolveSamplingParams(
  lm: LanguageModelAPI,
): Promise<{ temperature: number; topK: number }> {
  if (typeof lm.params !== 'function') {
    return { temperature: 0, topK: 1 };
  }
  try {
    return clampDeterministicParams(await lm.params());
  } catch {
    return { temperature: 0, topK: 1 };
  }
}

async function fitDigestToQuota(
  session: LanguageModelSession,
  links: readonly LinkItem[],
  buildPromptText: (digestText: string) => string,
): Promise<string> {
  const budgets = [
    { maxChars: 4000, maxSamples: 70 },
    { maxChars: 2600, maxSamples: 45 },
    { maxChars: 1600, maxSamples: 25 },
    { maxChars: 900, maxSamples: 12 },
  ];

  const hasQuotaCheck =
    typeof session.measureInputUsage === 'function' &&
    typeof session.inputQuota === 'number' &&
    Number.isFinite(session.inputQuota) &&
    session.inputQuota > 0;

  let promptText = buildPromptText(buildLibraryDigest(links, budgets[0]).text);
  if (!hasQuotaCheck || !session.measureInputUsage || !session.inputQuota) {
    return promptText;
  }

  const safeLimit = Math.floor(session.inputQuota * 0.78);
  for (const budget of budgets) {
    promptText = buildPromptText(buildLibraryDigest(links, budget).text);
    try {
      const usage = await session.measureInputUsage(promptText);
      if (usage <= safeLimit) {
        return promptText;
      }
    } catch {
      return promptText;
    }
  }

  return promptText;
}

/**
 * Pass 1 — Propose 5 to 8 clean, high-level collections from a compact library digest.
 */
export async function proposeCategories(
  links: readonly LinkItem[],
  options: {
    existingCollectionNames?: readonly string[];
    signal?: AbortSignal;
  } = {},
): Promise<ProposeCategoriesResult> {
  const lm = getLanguageModel();
  const availability = await checkNanoAvailability();
  if (!lm || availability !== 'available') {
    return {
      status: 'unavailable',
      availability,
      reason:
        'Chrome on-device Gemini Nano is not ready yet. Enable it in Settings → General & AI.',
    };
  }

  if (options.signal?.aborted) {
    return { status: 'canceled' };
  }

  const existingHint =
    options.existingCollectionNames &&
    options.existingCollectionNames.length > 0
      ? `Existing untouched collections you may align with where natural: ${options.existingCollectionNames.slice(0, 15).join(', ')}`
      : 'No existing collections need to be preserved.';

  let session: LanguageModelSession | null = null;
  try {
    const sampling = await resolveSamplingParams(lm);
    session = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      signal: options.signal,
      initialPrompts: [
        {
          role: 'system',
          content: [
            'You are a bookmark librarian organizing a personal link library.',
            'Analyze the library digest (top domains + sample titles) and propose 5 to 8 distinct, practical, high-level collections.',
            'Rules:',
            '1. Use clear, concise 1–3 word category names (e.g., "Dev & Tools", "Design", "Reading", "Finance", "3D Printing").',
            '2. Categories must be mutually distinct with minimal overlap.',
            '3. Provide a crisp 1-sentence description of what belongs in each category.',
            '4. Never include "Uncategorized" as a proposed category.',
            existingHint,
            'Return strict JSON: {"categories": [{"name": "...", "description": "..."}]}.',
          ].join('\n'),
        },
      ],
    });

    const promptText = await fitDigestToQuota(
      session,
      links,
      (digestText) =>
        `Propose 5 to 8 practical collections for this bookmark library:\n\n${digestText}`,
    );

    const raw = await session.prompt(promptText, {
      responseConstraint: PROPOSE_CATEGORIES_SCHEMA,
      signal: options.signal,
    });

    if (options.signal?.aborted) {
      return { status: 'canceled' };
    }

    const parsed = JSON.parse(stripJsonFences(raw)) as {
      categories?: RawProposedCategory[];
    };
    const categories = sanitizeProposedCategories(
      Array.isArray(parsed.categories) ? parsed.categories : [],
      { maxCount: 8 },
    );

    if (categories.length === 0) {
      return {
        status: 'error',
        reason: 'On-device AI returned no usable categories. Try regenerating.',
      };
    }

    return { status: 'ok', categories };
  } catch {
    if (options.signal?.aborted) {
      return { status: 'canceled' };
    }
    return {
      status: 'error',
      reason: 'Could not generate category proposals from on-device AI.',
    };
  } finally {
    session?.destroy();
  }
}

/**
 * Pass 2 — Deterministically sort each link into the user-approved categories
 * using one base LanguageModel session cloned per link for clean isolation.
 */
export async function sortLinksIntoCategories(
  links: readonly LinkItem[],
  approvedCategories: readonly ProposedCategory[],
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: SortLinksProgress) => void;
  } = {},
): Promise<SortLinksResult> {
  const lm = getLanguageModel();
  const availability = await checkNanoAvailability();
  if (!lm || availability !== 'available') {
    return {
      status: 'unavailable',
      availability,
      reason: 'Chrome on-device Gemini Nano is unavailable.',
    };
  }

  const approvedNames = approvedCategories
    .map((c) => c.name.trim())
    .filter((name) => name.length > 0);
  const allowedChoices = [...approvedNames, UNCATEGORIZED_CATEGORY_NAME];
  const allowedByLower = new Map(
    allowedChoices.map((name) => [name.toLowerCase(), name]),
  );

  const responseConstraint: Record<string, unknown> = {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: allowedChoices,
      },
    },
    required: ['category'],
  };

  const categoryGuide = approvedCategories
    .map(
      (c) =>
        `- ${c.name}: ${c.description || 'General links matching this topic'}`,
    )
    .join('\n');

  const assignments: Record<string, string> = {};
  let baseSession: LanguageModelSession | null = null;

  try {
    const sampling = await resolveSamplingParams(lm);
    baseSession = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      signal: options.signal,
      initialPrompts: [
        {
          role: 'system',
          content: [
            'You classify a single saved web bookmark into the single best matching collection from the approved list below.',
            `Choose "${UNCATEGORIZED_CATEGORY_NAME}" ONLY when the link genuinely does not fit any approved category.`,
            'Approved collections:',
            categoryGuide,
            'Return strict JSON: {"category": "<exact name from list>"}.',
          ].join('\n'),
        },
      ],
    });

    for (let i = 0; i < links.length; i++) {
      if (options.signal?.aborted) {
        return { status: 'canceled', assignments };
      }

      const link = links[i];
      if (!link) continue;

      options.onProgress?.({
        completed: i,
        total: links.length,
        currentTitle: link.title,
      });

      let itemSession: LanguageModelSession | null = null;
      let isClone = false;

      try {
        if (typeof baseSession.clone === 'function') {
          itemSession = await baseSession.clone({ signal: options.signal });
          isClone = true;
        } else {
          itemSession = baseSession;
        }

        const payload = JSON.stringify({
          title: link.title,
          domain: extractDomain(link.url),
          url: link.url,
          ...(link.tags.length > 0 ? { tags: link.tags.slice(0, 5) } : {}),
          ...(link.note ? { note: link.note.slice(0, 120) } : {}),
        });

        const raw = await itemSession.prompt(payload, {
          responseConstraint,
          signal: options.signal,
        });

        if (options.signal?.aborted) {
          return { status: 'canceled', assignments };
        }

        const parsed = JSON.parse(stripJsonFences(raw)) as {
          category?: unknown;
        };
        const rawChoice =
          typeof parsed.category === 'string' ? parsed.category.trim() : '';
        const matched =
          allowedByLower.get(rawChoice.toLowerCase()) ??
          UNCATEGORIZED_CATEGORY_NAME;
        assignments[link.id] = matched;
      } catch {
        if (options.signal?.aborted) {
          return { status: 'canceled', assignments };
        }
        assignments[link.id] = UNCATEGORIZED_CATEGORY_NAME;
      } finally {
        if (isClone) {
          itemSession?.destroy();
        }
      }

      options.onProgress?.({
        completed: i + 1,
        total: links.length,
        currentTitle: link.title,
      });
    }

    return { status: 'ok', assignments };
  } catch {
    if (options.signal?.aborted) {
      return { status: 'canceled', assignments };
    }
    return {
      status: 'error',
      reason: 'On-device sorting encountered an error.',
      assignments,
    };
  } finally {
    baseSession?.destroy();
  }
}
