import { playTagPop } from '@/lib/audio/foley';
import { autoTagSingleLink } from '@/lib/tagging/auto-tagger';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

/**
 * Fires non-blocking single-link auto-tagging while tracking live phosphor-scan
 * state in Zustand and playing a combo ping in Arcade mode when tags arrive.
 * Skips cleanly if a heavy on-device Nano batch job is already active, and
 * guarantees the glowing tag-scan state is cleared in `finally`.
 */
export async function triggerAutoTagSingleLink(
  linkId: string,
): Promise<string[] | null> {
  if (useBackgroundJobsStore.getState().hasActiveNanoJob()) {
    return null;
  }

  const { addTaggingLink, removeTaggingLink } = useUiStore.getState();
  let started = false;

  try {
    return await autoTagSingleLink(linkId, {
      onLinkStart: (id) => {
        started = true;
        addTaggingLink(id);
      },
      onLinkEnd: (id, tags) => {
        removeTaggingLink(id);
        if (tags && tags.length > 0) {
          playTagPop();
        }
      },
    });
  } finally {
    if (started) {
      removeTaggingLink(linkId);
    }
  }
}
