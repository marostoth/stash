import { pickCollectionIcon } from '@/lib/icons/aiIconPicker';
import { isValidCatalogIcon } from '@/lib/icons/catalog';
import { stashRepo } from '@/lib/storage/repo';

/**
 * Non-blocking background helper: asks Gemini Nano for a matching icon after a
 * collection is created, then re-reads storage to confirm the collection still
 * exists and still has no icon set before persisting (never overwrites manual picks).
 */
export async function autoAssignCollectionIconIfEmpty(
  collectionId: string,
  title: string,
  sampleLinkTitles?: readonly string[],
): Promise<string | null> {
  try {
    const suggested = await pickCollectionIcon(title, sampleLinkTitles);
    if (!suggested || !isValidCatalogIcon(suggested)) {
      return null;
    }

    const latestCollections = await stashRepo.getCollections();
    const target = latestCollections.find((c) => c.id === collectionId);
    if (!target || target.icon) {
      return null;
    }

    await stashRepo.updateCollection(collectionId, { icon: suggested });
    return suggested;
  } catch {
    return null;
  }
}
