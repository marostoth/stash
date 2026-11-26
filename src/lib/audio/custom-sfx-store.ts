import { storage } from '#imports';

export type SoundEventId =
  | 'drop'
  | 'pickup'
  | 'tagPop'
  | 'sessionFreeze'
  | 'hoverRiffle'
  | 'delete'
  | 'error';

export const SOUND_EVENT_META: ReadonlyArray<{
  id: SoundEventId;
  label: string;
  hint: string;
}> = [
  {
    id: 'drop',
    label: 'Drop Slam',
    hint: 'Dropping a card, tab, or row onto a collection or Space',
  },
  {
    id: 'pickup',
    label: 'Pickup',
    hint: 'Grabbing a card, tab, or collection to drag',
  },
  {
    id: 'tagPop',
    label: 'Star / Tag / Done',
    hint: 'Starring, checking off an item, or landing AI tags',
  },
  {
    id: 'sessionFreeze',
    label: 'Session Lock',
    hint: 'Saving an open-tabs session',
  },
  {
    id: 'hoverRiffle',
    label: 'Hover Detent',
    hint: 'Subtle brush when hovering cards in Arcade mode',
  },
  {
    id: 'delete',
    label: 'Delete',
    hint: 'Removing a link or bulk-deleting items',
  },
  {
    id: 'error',
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
