import { Globe, Layers } from 'lucide-react';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type Space,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

export const SIDE_PANEL_ALL_SPACES = '__all__';

interface SidePanelSpaceBarProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  links: readonly LinkItem[];
  activeSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
}

/**
 * Compact horizontal Space switcher for the Chrome Side Panel.
 * Includes an "All" scope pill plus every user Space with its icon and link count.
 */
export function SidePanelSpaceBar({
  spaces,
  collections,
  links,
  activeSpaceId,
  onSelectSpace,
}: SidePanelSpaceBarProps) {
  if (spaces.length <= 1) return null;

  const colSpaceMap = new Map<string, string>();
  for (const col of collections) {
    colSpaceMap.set(col.id, col.spaceId ?? DEFAULT_SPACE_ID);
  }

  const linkCountBySpace = new Map<string, number>();
  for (const link of links) {
    const sid = colSpaceMap.get(link.collectionId) ?? DEFAULT_SPACE_ID;
    linkCountBySpace.set(sid, (linkCountBySpace.get(sid) ?? 0) + 1);
  }

  const allActive = activeSpaceId === SIDE_PANEL_ALL_SPACES;

  return (
    <div
      role="tablist"
      aria-label="Spaces"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/75 bg-panel/55 px-3 py-1.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={allActive}
        onClick={() => onSelectSpace(SIDE_PANEL_ALL_SPACES)}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1 rounded-pill border px-2 text-[11px] font-medium transition-colors cursor-pointer',
          allActive
            ? 'border-accent/60 bg-accent/15 text-accent'
            : 'border-border/75 bg-canvas/70 text-fg-muted hover:border-accent/40 hover:text-fg',
        )}
      >
        <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>All</span>
        <span className="font-mono text-[9px] opacity-75">{links.length}</span>
      </button>

      {spaces.map((space) => {
        const active = activeSpaceId === space.id;
        const Icon = getCuratedCollectionIcon(space.icon) ?? Layers;
        const count = linkCountBySpace.get(space.id) ?? 0;

        return (
          <button
            key={space.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelectSpace(space.id)}
            className={cn(
              'inline-flex h-6 shrink-0 items-center gap-1 rounded-pill border px-2 text-[11px] font-medium transition-colors cursor-pointer',
              active
                ? 'border-accent/60 bg-accent/15 text-accent'
                : 'border-border/75 bg-canvas/70 text-fg-muted hover:border-accent/40 hover:text-fg',
            )}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="max-w-[92px] truncate">{space.name}</span>
            <span className="font-mono text-[9px] opacity-75">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
