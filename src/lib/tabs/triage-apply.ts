import { autoAssignCollectionIconIfEmpty } from '@/lib/icons/auto-assign-icon';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem } from '@/lib/types/stash';
import { normalizeTags } from '@/lib/utils/url';

export interface TriageApplyRow {
  link: LinkItem;
  destination: string;
  suggestionTags: readonly string[];
  suggestionSummaryNote?: string;
}

export interface TriageApplyOutcome {
  movedCount: number;
  deletedCount: number;
  skippedDuplicates: number;
}

export async function applyTriageRows(options: {
  triageCollectionId: string;
  rows: readonly TriageApplyRow[];
  newPrefix: string;
  deleteSentinel: string;
  deleteEmptySession: boolean;
}): Promise<TriageApplyOutcome> {
  const {
    triageCollectionId,
    rows,
    newPrefix,
    deleteSentinel,
    deleteEmptySession,
  } = options;

  const createdByName = new Map<
    string,
    { id: string; name: string; sampleTitles: string[] }
  >();
  const deleteIds: string[] = [];
  let movedCount = 0;
  let skippedDuplicates = 0;

  for (const row of rows) {
    if (!row.destination) continue;
    if (row.destination === deleteSentinel) {
      deleteIds.push(row.link.id);
      continue;
    }

    let targetCollectionId = row.destination;
    if (targetCollectionId.startsWith(newPrefix)) {
      const newName = targetCollectionId.slice(newPrefix.length).trim();
      const key = newName.toLowerCase();
      const existingNew = createdByName.get(key);
      if (existingNew) {
        targetCollectionId = existingNew.id;
        existingNew.sampleTitles.push(row.link.title);
      } else {
        const created = await stashRepo.createCollection({ name: newName });
        createdByName.set(key, {
          id: created.id,
          name: created.name,
          sampleTitles: [row.link.title],
        });
        targetCollectionId = created.id;
      }
    }

    const mergedTags = normalizeTags([...row.link.tags, ...row.suggestionTags]);
    const nextNote = row.link.note.trim() || row.suggestionSummaryNote || '';

    const moved = await stashRepo.moveOrReorderLink(
      row.link.id,
      targetCollectionId,
    );
    if (!moved.ok) {
      if (moved.reason === 'duplicate') {
        skippedDuplicates += 1;
      }
      continue;
    }

    if (
      mergedTags.length !== row.link.tags.length ||
      nextNote !== row.link.note
    ) {
      await stashRepo.updateLink(row.link.id, {
        tags: mergedTags,
        note: nextNote,
      });
    }
    movedCount += 1;
  }

  let deletedCount = 0;
  if (deleteIds.length > 0) {
    const removed = await stashRepo.deleteLinks(deleteIds);
    deletedCount = removed.length;
  }

  if (deleteEmptySession) {
    const remaining = (await stashRepo.getLinks()).filter(
      (l) => l.collectionId === triageCollectionId,
    );
    if (remaining.length === 0) {
      await stashRepo.deleteCollection(triageCollectionId);
    }
  }

  for (const created of createdByName.values()) {
    void autoAssignCollectionIconIfEmpty(
      created.id,
      created.name,
      created.sampleTitles,
    );
  }

  return { movedCount, deletedCount, skippedDuplicates };
}
