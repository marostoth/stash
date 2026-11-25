import {
  type Collection,
  DEFAULT_SPACE_ID,
  type Space,
} from '@/lib/types/stash';

interface SpaceGroupedCollectionOptionsProps {
  collections: readonly Collection[];
  spaces: readonly Space[];
}

/**
 * Renders `<optgroup label={space.name}>` around collection `<option>` elements
 * whenever multiple Spaces exist, or flat `<option>` elements for a single Space.
 */
export function SpaceGroupedCollectionOptions({
  collections,
  spaces,
}: SpaceGroupedCollectionOptionsProps) {
  if (spaces.length <= 1) {
    return (
      <>
        {collections.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
      </>
    );
  }

  const fallbackSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;
  const validSpaceIds = new Set(spaces.map((s) => s.id));
  const bySpace = new Map<string, Collection[]>();

  for (const col of collections) {
    const sid =
      col.spaceId && validSpaceIds.has(col.spaceId)
        ? col.spaceId
        : fallbackSpaceId;
    const bucket = bySpace.get(sid);
    if (bucket) {
      bucket.push(col);
    } else {
      bySpace.set(sid, [col]);
    }
  }

  return (
    <>
      {spaces.map((space) => {
        const groupCols = bySpace.get(space.id);
        if (!groupCols || groupCols.length === 0) return null;
        return (
          <optgroup key={space.id} label={space.name}>
            {groupCols.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
