import type {
  LanguageModelAPI,
  LanguageModelParams,
  NanoAvailabilityStatus,
} from '@/lib/categorizer/types';

export function getLanguageModel(): LanguageModelAPI | undefined {
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

export function normalizeAvailability(raw: string): NanoAvailabilityStatus {
  switch (raw) {
    case 'available':
    case 'readily':
      return 'available';
    case 'downloadable':
    case 'after-download':
      return 'downloadable';
    case 'downloading':
      return 'downloading';
    default:
      return 'unavailable';
  }
}

export function stripJsonFences(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ? fenced[1].trim() : trimmed;
}

export function clampDeterministicSampling(
  params?: Partial<LanguageModelParams> | null,
): { temperature: number; topK: number } {
  const maxTopK =
    typeof params?.maxTopK === 'number' && params.maxTopK >= 1
      ? Math.floor(params.maxTopK)
      : 1;
  const maxTemp =
    typeof params?.maxTemperature === 'number' && params.maxTemperature >= 0
      ? params.maxTemperature
      : 0;
  return {
    temperature: Math.min(0, maxTemp),
    topK: Math.min(1, maxTopK),
  };
}

export async function resolveDeterministicSampling(
  lm: LanguageModelAPI,
): Promise<{ temperature: number; topK: number }> {
  if (typeof lm.params !== 'function') {
    return { temperature: 0, topK: 1 };
  }
  try {
    return clampDeterministicSampling(await lm.params());
  } catch {
    return { temperature: 0, topK: 1 };
  }
}
