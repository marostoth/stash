import {
  checkNanoAvailability,
  NANO_AVAILABILITY_OPTIONS,
} from '@/lib/categorizer/nano-engine';
import type {
  LanguageModelAPI,
  LanguageModelSession,
} from '@/lib/categorizer/types';
import { clampDeterministicParams } from '@/lib/tagging/auto-tagger';

const NANO_TIEBREAKER_TIMEOUT_MS = 3500;

const TIEBREAKER_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    isDead: { type: 'boolean' },
    reason: { type: 'string', maxLength: 48 },
  },
  required: ['isDead', 'reason'],
};

export interface NanoSoftDeadVerdict {
  isDead: boolean;
  reason: string;
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

/**
 * Optional on-device Gemini Nano tie-breaker for suspicious 200 OK pages
 * (empty title or generic parking/error hints). Fails silently and never stalls.
 */
export async function verifySuspiciousPageWithNano(
  input: { url: string; title?: string; snippet?: string },
  outerSignal?: AbortSignal,
): Promise<NanoSoftDeadVerdict | null> {
  if (outerSignal?.aborted) return null;

  const lm = getLanguageModel();
  if (!lm) return null;

  const availability = await checkNanoAvailability();
  if (availability !== 'available') return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    NANO_TIEBREAKER_TIMEOUT_MS,
  );
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });

  let session: LanguageModelSession | null = null;
  try {
    const params =
      typeof lm.params === 'function'
        ? await lm.params().catch(() => null)
        : null;
    const sampling = clampDeterministicParams(params);

    session = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      signal: controller.signal,
      initialPrompts: [
        {
          role: 'system',
          content:
            'Classify whether an HTTP 200 web page is actually dead (parked/for-sale domain, expired domain, account suspended, or soft-404 error page) vs a real working page. Be conservative: only set isDead=true when clearly dead/parked. Return strict JSON: {"isDead": boolean, "reason": "short 2-4 word label"}.',
        },
      ],
    });

    const raw = await session.prompt(
      JSON.stringify({
        url: input.url,
        title: input.title ?? '',
        snippet: (input.snippet ?? '').slice(0, 360),
      }),
      {
        responseConstraint: TIEBREAKER_SCHEMA,
        signal: controller.signal,
      },
    );

    const parsed = JSON.parse(raw.trim()) as {
      isDead?: unknown;
      reason?: unknown;
    };
    if (typeof parsed.isDead !== 'boolean') return null;
    const reason =
      typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 48)
        : 'Soft dead (AI)';
    return { isDead: parsed.isDead, reason };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    outerSignal?.removeEventListener('abort', onOuterAbort);
    session?.destroy();
  }
}
