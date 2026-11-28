import { storage } from '#imports';

export type SoundEventId =
  | 'pickup'
  | 'drop'
  | 'hoverRiffle'
  | 'tagPop'
  | 'uncheck'
  | 'sessionFreeze'
  | 'delete'
  | 'error';

export type SoundEventCategory = 'drag' | 'progress' | 'alerts';
export type SoundModeScope = 'all' | 'arcade-boost' | 'arcade-only';

export interface SoundEventMeta {
  id: SoundEventId;
  category: SoundEventCategory;
  modeScope: SoundModeScope;
  label: string;
  hint: string;
}

export const SOUND_EVENT_GROUPS: ReadonlyArray<{
  id: SoundEventCategory;
  title: string;
}> = [
  { id: 'drag', title: 'Drag & Movement' },
  { id: 'progress', title: 'Progress & Milestones' },
  { id: 'alerts', title: 'Destructive & Alerts' },
];

export const SOUND_EVENT_META: readonly SoundEventMeta[] = [
  {
    id: 'pickup',
    category: 'drag',
    modeScope: 'all',
    label: 'Pickup',
    hint: 'Grabbing a card, tab, or collection to drag',
  },
  {
    id: 'drop',
    category: 'drag',
    modeScope: 'arcade-boost',
    label: 'Drop Slam',
    hint: 'Dropping a card or tab (combo pitch + 5x shimmer in Arcade)',
  },
  {
    id: 'hoverRiffle',
    category: 'drag',
    modeScope: 'arcade-only',
    label: 'Hover Detent',
    hint: 'Whisper-quiet brush when sweeping across cards (Arcade only)',
  },
  {
    id: 'tagPop',
    category: 'progress',
    modeScope: 'arcade-boost',
    label: 'Check Off / Star / Tag',
    hint: 'Checking an item done, starring, or landing tags (5x shimmer in Arcade)',
  },
  {
    id: 'uncheck',
    category: 'progress',
    modeScope: 'all',
    label: 'Uncheck',
    hint: 'Soft mechanical release tick when unchecking an item',
  },
  {
    id: 'sessionFreeze',
    category: 'progress',
    modeScope: 'arcade-boost',
    label: 'Session Lock',
    hint: 'Saving a tab session or applying Smart Reorganize (fuller chord in Arcade)',
  },
  {
    id: 'delete',
    category: 'alerts',
    modeScope: 'all',
    label: 'Delete',
    hint: 'Removing cards, deleting collections, or clearing open tabs',
  },
  {
    id: 'error',
    category: 'alerts',
    modeScope: 'all',
    label: 'Blocked',
    hint: 'Duplicate URL guard or invalid action',
  },
];

export const MAX_CUSTOM_SFX_BYTES = 512 * 1024; // 512 KB per clip

const ALLOWED_AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|webm|m4a)$/i;

export interface CustomSfxClip {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  updatedAt: string;
}

export type CustomSfxMap = Partial<Record<SoundEventId, CustomSfxClip>>;

const customSfxStorage = storage.defineItem<CustomSfxMap>(
  'local:stash_custom_sfx',
  {
    version: 1,
    fallback: {},
  },
);

export function validateCustomAudioFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: 'Audio file is empty.' };
  }
  if (file.size > MAX_CUSTOM_SFX_BYTES) {
    return {
      ok: false,
      error: `Clip too large (${Math.round(file.size / 1024)} KB). Maximum is 512 KB per sound.`,
    };
  }
  const hasAudioMime = file.type.toLowerCase().startsWith('audio/');
  const hasAllowedExt = ALLOWED_AUDIO_EXTENSIONS.test(file.name);
  if (!hasAudioMime && !hasAllowedExt) {
    return {
      ok: false,
      error: 'Unsupported format. Use .mp3, .wav, .ogg, .webm, or .m4a.',
    };
  }
  return { ok: true };
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  try {
    const base64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

export async function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read audio file'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export const customSfxStore = {
  async getAll(): Promise<CustomSfxMap> {
    const stored = await customSfxStorage.getValue();
    return stored && typeof stored === 'object' ? stored : {};
  },

  watch(cb: (map: CustomSfxMap) => void): () => void {
    return customSfxStorage.watch((next) =>
      cb(next && typeof next === 'object' ? next : {}),
    );
  },

  async setClip(
    eventId: SoundEventId,
    clip: CustomSfxClip,
  ): Promise<CustomSfxMap> {
    const current = await this.getAll();
    const next: CustomSfxMap = { ...current, [eventId]: clip };
    await customSfxStorage.setValue(next);
    return next;
  },

  async removeClip(eventId: SoundEventId): Promise<CustomSfxMap> {
    const current = await this.getAll();
    const next: CustomSfxMap = { ...current };
    delete next[eventId];
    await customSfxStorage.setValue(next);
    return next;
  },

  async clearAll(): Promise<void> {
    await customSfxStorage.setValue({});
  },
};
