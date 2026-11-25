import {
  checkNanoAvailability,
  NANO_AVAILABILITY_OPTIONS,
} from '@/lib/categorizer/nano-engine';
import type {
  LanguageModelAPI,
  LanguageModelParams,
  LanguageModelSession,
} from '@/lib/categorizer/types';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';

export const AUTO_TAG_RESPONSE_CONSTRAINT: Record<string, unknown> = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string', maxLength: 32 },
      maxItems: 3,
    },
  },
  required: ['tags'],
};

export interface AutoTagProgress {
  current: number;
  total: number;
  tagged: number;
}

export interface AutoTagSweepResult {
  status: 'completed' | 'canceled' | 'unavailable';
  tagged: number;
  skipped: number;
  total: number;
}

export interface AutoTagLifecycleHooks {
  onLinkStart?: (linkId: string) => void;
  onLinkEnd?: (linkId: string, tags: string[] | null) => void;
}

export interface BatchAutoTagOptions extends AutoTagLifecycleHooks {
  collectionId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: AutoTagProgress) => void;
}

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

export function isEligibleForAutoTag(link: LinkItem): boolean {
  return link.tags.length === 0 && !link.tagsLocked;
}

export function filterEligibleLinks(
  links: readonly LinkItem[],
  collectionId?: string,
): LinkItem[] {
  return links.filter(
    (link) =>
      isEligibleForAutoTag(link) &&
      (collectionId === undefined || link.collectionId === collectionId),
  );
}

export function extractTopExistingTags(
  links: readonly LinkItem[],
  limit = 50,
): string[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    for (const raw of link.tags) {
      const normalized = raw.trim().replace(/^#+/, '').toLowerCase();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function normalizeTagToken(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._+-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sanitizeGeneratedTags(
  rawTags: readonly string[],
  collectionName?: string,
): string[] {
  const blockedCompact = collectionName ? compactKey(collectionName) : '';
  const blockedKebab = collectionName ? normalizeTagToken(collectionName) : '';

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTags) {
    const cleaned = normalizeTagToken(raw);
    if (!cleaned) continue;
    if (
      (blockedKebab && cleaned === blockedKebab) ||
      (blockedCompact && compactKey(cleaned) === blockedCompact)
    ) {
      continue;
    }
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= 3) break;
  }

  return result;
}

function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ? fenced[1].trim() : trimmed;
}

export function parseAutoTagResponse(
  rawText: string,
  collectionName?: string,
): string[] {
  try {
    const parsed = JSON.parse(stripJsonFences(rawText)) as { tags?: unknown };
    if (!parsed || !Array.isArray(parsed.tags)) return [];
    const stringTags = parsed.tags.filter(
      (item): item is string => typeof item === 'string',
    );
    return sanitizeGeneratedTags(stringTags, collectionName);
  } catch {
    return [];
  }
}

export function clampDeterministicParams(
  params: LanguageModelParams | null | undefined,
): { temperature: number; topK: number } {
  const maxTemp =
    typeof params?.maxTemperature === 'number' &&
    Number.isFinite(params.maxTemperature) &&
    params.maxTemperature >= 0
      ? params.maxTemperature
      : 2;
  const maxTopK =
    typeof params?.maxTopK === 'number' &&
    Number.isFinite(params.maxTopK) &&
    params.maxTopK >= 1
      ? Math.floor(params.maxTopK)
      : 1;

  return {
    temperature: Math.max(0, Math.min(0, maxTemp)),
    topK: Math.max(1, Math.min(1, maxTopK)),
  };
}

function buildTaggingInitialPrompts(
  existingTags: readonly string[],
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const vocabLine =
    existingTags.length > 0
      ? `Existing user tag vocabulary (reuse matching tags first): ${existingTags.join(', ')}`
      : 'Existing user tag vocabulary: (none yet)';

  return [
    {
      role: 'system',
      content: [
        'You generate 1-3 concise lowercase tags for a saved web bookmark and return strict JSON: {"tags": [...]}.',
        'Rules:',
        '1. Reuse matching tags from the existing user tag vocabulary before inventing new ones.',
        '2. NEVER duplicate the exact collectionName as a tag.',
        '3. Keep tags short, lowercase, specific, and kebab-case for multi-word terms (max 3 tags, no # prefix).',
        vocabLine,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        title: 'Build extensions with coding agents | Chrome for Developers',
        domain: 'developer.chrome.com',
        url: 'https://developer.chrome.com/docs/extensions',
        collectionName: 'Dev',
      }),
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        tags: ['chrome', 'extensions', 'docs'],
      }),
    },
  ];
}

function buildLinkPromptPayload(
  link: LinkItem,
  collectionName: string,
): string {
  return JSON.stringify({
    title: link.title,
    domain: extractDomain(link.url),
    url: link.url,
    collectionName,
  });
}

async function resolveSamplingParams(
  lm: LanguageModelAPI,
): Promise<{ temperature: number; topK: number }> {
  if (typeof lm.params !== 'function') {
    return { temperature: 0, topK: 1 };
  }
  try {
    const params = await lm.params();
    return clampDeterministicParams(params);
  } catch {
    return { temperature: 0, topK: 1 };
  }
}

/**
 * Trigger A — Non-blocking single-link auto-tagging after manual save.
 * Gracefully no-ops if disabled, unavailable, or if link was edited/deleted mid-flight.
 */
export async function autoTagSingleLink(
  linkId: string,
  hooks?: AutoTagLifecycleHooks,
): Promise<string[] | null> {
  const settings = await stashRepo.getSettings();
  if (!settings.autoTagOnSave) return null;

  const lm = getLanguageModel();
  if (!lm) return null;

  const availability = await checkNanoAvailability();
  if (availability !== 'available') return null;

  const snapshot = await stashRepo.getSnapshot();
  const targetLink = snapshot.links.find((item) => item.id === linkId);
  if (!targetLink || !isEligibleForAutoTag(targetLink)) return null;

  const collectionName =
    snapshot.collections.find((c) => c.id === targetLink.collectionId)?.name ??
    '';
  const existingTags = extractTopExistingTags(snapshot.links, 50);

  let session: LanguageModelSession | null = null;
  let appliedTags: string[] | null = null;
  hooks?.onLinkStart?.(linkId);
  try {
    const sampling = await resolveSamplingParams(lm);
    session = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      initialPrompts: buildTaggingInitialPrompts(existingTags),
    });

    const rawText = await session.prompt(
      buildLinkPromptPayload(targetLink, collectionName),
      { responseConstraint: AUTO_TAG_RESPONSE_CONSTRAINT },
    );

    const tags = parseAutoTagResponse(rawText, collectionName);
    if (tags.length === 0) return null;

    const updated = await stashRepo.applyAutoTagsIfEligible(linkId, tags);
    appliedTags = updated ? updated.tags : null;
    return appliedTags;
  } catch {
    return null;
  } finally {
    session?.destroy();
    hooks?.onLinkEnd?.(linkId, appliedTags);
  }
}

/**
 * Trigger B — On-demand batch sweep using one base LanguageModel session cloned
 * per eligible link for fast, isolated tagging with clean abort support.
 */
export async function runBatchAutoTagSweep(
  options: BatchAutoTagOptions = {},
): Promise<AutoTagSweepResult> {
  const { collectionId, signal, onProgress, onLinkStart, onLinkEnd } = options;

  const lm = getLanguageModel();
  if (!lm) {
    return { status: 'unavailable', tagged: 0, skipped: 0, total: 0 };
  }

  const availability = await checkNanoAvailability();
  if (availability !== 'available') {
    return { status: 'unavailable', tagged: 0, skipped: 0, total: 0 };
  }

  const snapshot = await stashRepo.getSnapshot();
  const eligible = filterEligibleLinks(snapshot.links, collectionId);
  if (eligible.length === 0) {
    return { status: 'completed', tagged: 0, skipped: 0, total: 0 };
  }

  const collectionNameById = new Map(
    snapshot.collections.map((c) => [c.id, c.name]),
  );
  const existingTags = extractTopExistingTags(snapshot.links, 50);

  let baseSession: LanguageModelSession | null = null;
  let tagged = 0;
  let skipped = 0;

  try {
    const sampling = await resolveSamplingParams(lm);
    baseSession = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      signal,
      initialPrompts: buildTaggingInitialPrompts(existingTags),
    });

    for (let i = 0; i < eligible.length; i++) {
      if (signal?.aborted) {
        return {
          status: 'canceled',
          tagged,
          skipped,
          total: eligible.length,
        };
      }

      const link = eligible[i];
      if (!link) continue;

      onProgress?.({ current: i + 1, total: eligible.length, tagged });

      const collectionName = collectionNameById.get(link.collectionId) ?? '';
      let itemSession: LanguageModelSession | null = null;
      let isClone = false;
      let appliedTags: string[] | null = null;
      onLinkStart?.(link.id);

      try {
        if (typeof baseSession.clone === 'function') {
          itemSession = await baseSession.clone({ signal });
          isClone = true;
        } else {
          itemSession = baseSession;
        }

        const rawText = await itemSession.prompt(
          buildLinkPromptPayload(link, collectionName),
          {
            responseConstraint: AUTO_TAG_RESPONSE_CONSTRAINT,
            signal,
          },
        );

        if (signal?.aborted) {
          return {
            status: 'canceled',
            tagged,
            skipped,
            total: eligible.length,
          };
        }

        const tags = parseAutoTagResponse(rawText, collectionName);
        if (tags.length === 0) {
          skipped += 1;
          continue;
        }

        const updated = await stashRepo.applyAutoTagsIfEligible(link.id, tags);
        if (updated) {
          appliedTags = updated.tags;
          tagged += 1;
        } else {
          skipped += 1;
        }
      } catch {
        if (signal?.aborted) {
          return {
            status: 'canceled',
            tagged,
            skipped,
            total: eligible.length,
          };
        }
        skipped += 1;
      } finally {
        if (isClone) {
          itemSession?.destroy();
        }
        onLinkEnd?.(link.id, appliedTags);
      }
    }

    return {
      status: signal?.aborted ? 'canceled' : 'completed',
      tagged,
      skipped,
      total: eligible.length,
    };
  } catch {
    return {
      status: signal?.aborted ? 'canceled' : 'completed',
      tagged,
      skipped,
      total: eligible.length,
    };
  } finally {
    baseSession?.destroy();
  }
}
