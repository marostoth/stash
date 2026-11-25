import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import type { Collection, LinkItem } from '@/lib/types/stash';

export type DragItemData =
  | {
      kind: 'open-tab';
      tab: OpenTabInfo;
    }
  | {
      kind: 'link';
      link: LinkItem;
      collectionId: string;
      index: number;
    }
  | {
      kind: 'collection';
      collection: Collection;
      index: number;
    };

export type DropTargetData =
  | {
      kind: 'link';
      link: LinkItem;
      collectionId: string;
      index: number;
    }
  | {
      kind: 'collection';
      collection: Collection;
      index: number;
    }
  | {
      kind: 'collection-drop';
      collectionId: string;
    };

export function isDragItemData(value: unknown): value is DragItemData {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'open-tab' || kind === 'link' || kind === 'collection';
}

export function isDropTargetData(value: unknown): value is DropTargetData {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'link' || kind === 'collection' || kind === 'collection-drop';
}
