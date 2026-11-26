import {
  type Collection,
  DEFAULT_SPACE_ID,
  type Space,
} from '@/lib/types/stash';

export const SPACE_INBOX_VALUE_PREFIX = '__space_inbox__:';

export function makeSpaceInboxValue(spaceId: string): string {
  return `${SPACE_INBOX_VALUE_PREFIX}${spaceId}`;
}

export function parseSpaceInboxValue(value: string): string | null {
  if (!value.startsWith(SPACE_INBOX_VALUE_PREFIX)) return null;
  const spaceId = value.slice(SPACE_INBOX_VALUE_PREFIX.length).trim();
  return spaceId || null;
}

interface SpaceGroupedCollectionOptionsProps {
  collections: readonly Collection[];
  spaces: readonly Space[];
  /** Include a `→ Inbox (auto)` option for Spaces without an Inbox (default true) */
  allowSpaceInbox?: boolean;
}

/**
 * Renders `<optgroup label={space.name}>` around collection `<option>` elements
 * whenever multiple Spaces exist, or flat `<option>` elements for a single Space.
 * Empty Spaces (and Spaces without an Inbox) get an automatic `→ Inbox (auto)`
 * target so cards can always be sent directly into any Space.
 */
export function SpaceGroupedCollectionOptions({
  collections,
  spaces,
  allowSpaceInbox = true,
}: SpaceGroupedCollectionOptionsProps) {
  if (spaces.length <= 1) {
    const singleSpace = spaces[0];
    const hasInbox = collections.some(
      (col) =>
        !col.isSession &&
        (col.isAutoInbox === true || col.name.trim().toLowerCase() === 'inbox'),
    );
    return (
      <>
        {collections.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
        {allowSpaceInbox &&
          singleSpace &&
          collections.length === 0 &&
          !hasInbox && (
            <option value={makeSpaceInboxValue(singleSpace.id)}>
              → Inbox (auto)
            </option>
          )}
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
        const groupCols = bySpace.get(space.id) ?? [];
        const hasInbox = groupCols.some(
          (col) =>
            !col.isSession &&
            (col.isAutoInbox === true ||
              col.name.trim().toLowerCase() === 'inbox'),
        );
        const showAutoInbox = allowSpaceInbox && !hasInbox;
        if (groupCols.length === 0 && !showAutoInbox) return null;

        return (
          <optgroup key={space.id} label={space.name}>
            {showAutoInbox && (
              <option value={makeSpaceInboxValue(space.id)}>
                → Inbox (auto)
              </option>
            )}
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
