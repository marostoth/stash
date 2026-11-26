import { ArrowUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { stashRepo } from '@/lib/storage/repo';
import type { Collection, CollectionSortMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  COLLECTION_SORT_OPTIONS,
  getCollectionSortMeta,
} from '@/lib/utils/collection-sort';

interface CollectionSortMenuProps {
  collection: Collection;
}

export function CollectionSortMenu({ collection }: CollectionSortMenuProps) {
  const activeSort: CollectionSortMode = collection.sortMode ?? 'manual';
  const meta = getCollectionSortMeta(activeSort);
  const isSorted = activeSort !== 'manual';

  const handleSelect = (nextMode: CollectionSortMode) => {
    if (nextMode === activeSort) return;
    void stashRepo.updateCollection(collection.id, { sortMode: nextMode });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={isSorted ? 'sm' : 'icon'}
          aria-label={`Sort ${collection.name} (currently ${meta.label})`}
          title={
            isSorted
              ? `Sorted by ${meta.label} (manual drag paused — click to change)`
              : 'Sort collection links'
          }
          className={cn(
            'h-7 text-fg-muted hover:text-accent',
            isSorted
              ? 'gap-1 border border-accent/40 bg-accent/12 px-2 font-mono text-[11px] text-accent hover:bg-accent/18'
              : 'w-7',
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          {isSorted && <span>{meta.shortLabel}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Sort Links</DropdownMenuLabel>
        {COLLECTION_SORT_OPTIONS.map((opt) => {
          const selected = opt.id === activeSort;
          return (
            <DropdownMenuItem
              key={opt.id}
              onSelect={() => handleSelect(opt.id)}
              className={cn(selected && 'text-accent')}
            >
              <Check
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  selected ? 'opacity-100 text-accent' : 'opacity-0',
                )}
              />
              <span>{opt.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
