import { NANO_AVAILABILITY_OPTIONS } from '@/lib/categorizer/nano-engine';
import type {
  LanguageModelAPI,
  LanguageModelSession,
} from '@/lib/categorizer/types';
import { CATALOG_ICON_KEYS, isValidCatalogIcon } from '@/lib/icons/catalog';
import { clampDeterministicParams } from '@/lib/tagging/auto-tagger';

export interface CollectionIconInput {
  id: string;
  title: string;
  sampleLinkTitles?: readonly string[];
}

export interface BatchIconProgress {
  completed: number;
  total: number;
  currentTitle: string;
}

const ICON_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    icon: {
      type: 'string',
      enum: [...CATALOG_ICON_KEYS],
    },
  },
  required: ['icon'],
};

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

async function resolveDeterministicSampling(
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

function buildSystemPrompt(): string {
  return [
    'You select the single best Lucide icon key for a browser bookmark collection.',
    `Allowed icon keys: ${CATALOG_ICON_KEYS.join(', ')}`,
    'Choose the most specific, intuitive key from the allowed list. Use "folder" only if nothing else fits.',
    'Return strict JSON: {"icon": "<allowed-key>"}.',
  ].join('\n');
}

function buildItemPrompt(
  title: string,
  sampleLinkTitles?: readonly string[],
): string {
  const cleanTitle = title.trim().slice(0, 80);
  const samples = (sampleLinkTitles ?? [])
    .map((t) => t.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 5);

  if (samples.length === 0) {
    return `Collection title: "${cleanTitle}"`;
  }
  return `Collection title: "${cleanTitle}"\nSample bookmarks: ${samples.join(' | ')}`;
}

function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ? fenced[1].trim() : trimmed;
}

function parseValidatedIcon(raw: string): string | null {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as { icon?: unknown };
    if (typeof parsed.icon !== 'string') return null;
    const key = parsed.icon.trim();
    return isValidCatalogIcon(key) ? key : null;
  } catch {
    return null;
  }
}

async function promptForIcon(
  session: LanguageModelSession,
  input: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const raw = await session.prompt(input, {
      responseConstraint: ICON_RESPONSE_SCHEMA,
      omitResponseConstraintInput: true,
      signal,
    });
    return parseValidatedIcon(raw);
  } catch (error: unknown) {
    if (signal?.aborted) return null;
    // Fallback gracefully if Chrome rejects omitResponseConstraintInput
    try {
      const raw = await session.prompt(input, {
        responseConstraint: ICON_RESPONSE_SCHEMA,
        signal,
      });
      return parseValidatedIcon(raw);
    } catch {
      void error;
      return null;
    }
  }
}

async function createBaseIconSession(
  lm: LanguageModelAPI,
  signal?: AbortSignal,
): Promise<LanguageModelSession | null> {
  try {
    const availability = await lm.availability(NANO_AVAILABILITY_OPTIONS);
    if (availability !== 'available') {
      return null;
    }
  } catch {
    return null;
  }

  const sampling = await resolveDeterministicSampling(lm);
  return lm.create({
    ...NANO_AVAILABILITY_OPTIONS,
    ...sampling,
    signal,
    initialPrompts: [{ role: 'system', content: buildSystemPrompt() }],
  });
}

/**
 * Uses on-device Gemini Nano to pick a single validated catalog icon key
 * for a collection. Returns `null` silently if Nano is unavailable or errors.
 */
export async function pickCollectionIcon(
  title: string,
  sampleLinkTitles?: readonly string[],
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const trimmed = title.trim();
  if (!trimmed || options.signal?.aborted) return null;

  const lm = getLanguageModel();
  if (!lm) return null;

  let session: LanguageModelSession | null = null;
  try {
    session = await createBaseIconSession(lm, options.signal);
    if (!session || options.signal?.aborted) return null;

    return await promptForIcon(
      session,
      buildItemPrompt(trimmed, sampleLinkTitles),
      options.signal,
    );
  } catch {
    return null;
  } finally {
    session?.destroy();
  }
}

/**
 * Batch-picks validated catalog icons using ONE base LanguageModel session
 * cloned per collection (destroying each clone immediately, and baseSession in finally).
 */
export async function pickIconsForCollections(
  items: readonly CollectionIconInput[],
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: BatchIconProgress) => void;
    onItemPicked?: (id: string, icon: string) => Promise<void> | void;
  } = {},
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  if (items.length === 0 || options.signal?.aborted) return results;

  const lm = getLanguageModel();
  if (!lm) return results;

  let baseSession: LanguageModelSession | null = null;
  try {
    baseSession = await createBaseIconSession(lm, options.signal);
    if (!baseSession || options.signal?.aborted) return results;

    for (let i = 0; i < items.length; i++) {
      if (options.signal?.aborted) break;
      const item = items[i];
      if (!item) continue;

      options.onProgress?.({
        completed: i,
        total: items.length,
        currentTitle: item.title,
      });

      const trimmedTitle = item.title.trim();
      if (!trimmedTitle) continue;

      let itemSession: LanguageModelSession | null = null;
      let isClone = false;

      try {
        if (typeof baseSession.clone === 'function') {
          itemSession = await baseSession.clone({ signal: options.signal });
          isClone = true;
        } else {
          itemSession = baseSession;
        }

        const picked = await promptForIcon(
          itemSession,
          buildItemPrompt(trimmedTitle, item.sampleLinkTitles),
          options.signal,
        );
        if (picked) {
          results[item.id] = picked;
          await options.onItemPicked?.(item.id, picked);
        }
      } catch {
        // Ignore single-item failures and continue batch
      } finally {
        if (isClone) {
          itemSession?.destroy();
        }
      }

      options.onProgress?.({
        completed: i + 1,
        total: items.length,
        currentTitle: item.title,
      });
    }

    return results;
  } catch {
    return results;
  } finally {
    baseSession?.destroy();
  }
}
