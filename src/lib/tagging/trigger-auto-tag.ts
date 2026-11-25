import { playTagPop } from '@/lib/audio/foley';
import { autoTagSingleLink } from '@/lib/tagging/auto-tagger';
import { useUiStore } from '@/store/ui-store';

/**
 * Fires non-blocking single-link auto-tagging while tracking live phosphor-scan
 * state in Zustand and playing a combo ping in Arcade mode when tags arrive.
 */
export function triggerAutoTagSingleLink(
  linkId: string,
): Promise<string[] | null> {
  const { addTaggingLink, removeTaggingLink } = useUiStore.getState();
  return autoTagSingleLink(linkId, {
    onLinkStart: (id) => addTaggingLink(id),
    onLinkEnd: (id, tags) => {
      removeTaggingLink(id);
      if (tags && tags.length > 0) {
        playTagPop();
      }
    },
  });
}
