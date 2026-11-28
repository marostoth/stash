import {
  Check,
  ChevronDown,
  Inbox,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  makeSpaceInboxValue,
  parseSpaceInboxValue,
} from '@/components/ui/space-grouped-collection-options';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type Space,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface QuickStashCollectionPickerProps {
  spaces: readonly Space[];
  orderedCollections: readonly Collection[];
  selectedCollectionId: string;
  onSelectCollection: (collectionId: string) => void;
  categorizing: boolean;
  enrichingTags: boolean;
  suggestion: CategorizationSuggestion | null;
  creatingName: string | null;
  onChangeCreatingName: (next: string | null) => void;
  onCreateCollection: (name: string) => void;
}

function getSuggestionBadgeLabel(suggestion: CategorizationSuggestion): string {
  if (suggestion.source === 'rule') {
    return suggestion.matchedRuleName || 'Rule match';
  }
  if (suggestion.source === 'library') {
    return 'Matched';
  }
  return suggestion.collectionId ? 'On-Device AI' : 'AI tags';
}

function CollectionGlyph({ collection }: { collection: Collection }) {
  const Icon = getCuratedCollectionIcon(collection.icon);
  const colorHex =
    collection.tintColor ?? TAB_GROUP_COLOR_SWATCH[collection.color];
  if (Icon) {
    return (
      <Icon
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: colorHex }}
        aria-hidden="true"
      />
    );
  }
  if (collection.icon) {
    return (
      <span className="shrink-0 text-xs leading-none" aria-hidden="true">
        {collection.icon}
      </span>
    );
  }
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colorHex }}
      aria-hidden="true"
    />
  );
}

/**
 * Custom Radix DropdownMenu collection picker replacing the native `<select>`.
 * Displays collection icons/color dots, Space grouping, subtle AI badges, and
 * fast inline `+ New collection` creation without clipping at 320px–480px+.
 */
export function QuickStashCollectionPicker({
  spaces,
  orderedCollections,
  selectedCollectionId,
  onSelectCollection,
  categorizing,
  enrichingTags,
  suggestion,
  creatingName,
  onChangeCreatingName,
  onCreateCollection,
}: QuickStashCollectionPickerProps) {
  const multiSpace = spaces.length > 1;
  const fallbackSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;

  const spaceById = useMemo(
    () => new Map(spaces.map((s) => [s.id, s])),
    [spaces],
  );

  const groupedBySpace = useMemo(() => {
    const validIds = new Set(spaces.map((s) => s.id));
    const buckets = new Map<string, Collection[]>();
    for (const col of orderedCollections) {
      const sid =
        col.spaceId && validIds.has(col.spaceId)
          ? col.spaceId
          : fallbackSpaceId;
      const list = buckets.get(sid);
      if (list) list.push(col);
      else buckets.set(sid, [col]);
    }
    return spaces.map((space) => {
      const cols = buckets.get(space.id) ?? [];
      const hasInbox = cols.some(
        (c) =>
          !c.isSession &&
          (c.isAutoInbox === true || c.name.trim().toLowerCase() === 'inbox'),
      );
      return {
        space,
        cols,
        showAutoInbox: multiSpace ? !hasInbox : cols.length === 0 && !hasInbox,
      };
    });
  }, [fallbackSpaceId, multiSpace, orderedCollections, spaces]);

  const selectedCollection = useMemo(
    () => orderedCollections.find((c) => c.id === selectedCollectionId) ?? null,
    [orderedCollections, selectedCollectionId],
  );
  const selectedInboxSpaceId = parseSpaceInboxValue(selectedCollectionId);
  const selectedSpaceName = useMemo(() => {
    if (!multiSpace) return null;
    if (selectedInboxSpaceId) {
      return spaceById.get(selectedInboxSpaceId)?.name ?? null;
    }
    if (!selectedCollection) return null;
    const sid = selectedCollection.spaceId ?? fallbackSpaceId;
    return spaceById.get(sid)?.name ?? null;
  }, [
    fallbackSpaceId,
    multiSpace,
    selectedCollection,
    selectedInboxSpaceId,
    spaceById,
  ]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          Collection
        </span>
        {categorizing ? (
          <span className="inline-flex items-center gap-1 rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.25 font-mono text-[10px] text-accent">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Matching...
          </span>
        ) : suggestion && suggestion.source !== 'none' ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.25 font-mono text-[10px]',
              suggestion.collectionId
                ? 'border-accent/30 bg-accent/8 text-accent'
                : 'border-hairline bg-canvas/80 text-fg-muted',
            )}
          >
            {enrichingTags ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Sparkles className="h-2.5 w-2.5" />
            )}
            <span className="max-w-[140px] truncate">
              {getSuggestionBadgeLabel(suggestion)}
            </span>
          </span>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Target collection"
            className={cn(
              'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-control border bg-[var(--stash-card)] px-2.5 text-left text-xs text-fg shadow-[inset_0_1px_0_color-mix(in_srgb,var(--stash-text)_6%,transparent)] transition-colors hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 cursor-pointer',
              categorizing ? 'border-accent/45 text-fg-muted' : 'border-border',
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {selectedCollection ? (
                <>
                  <CollectionGlyph collection={selectedCollection} />
                  <span className="truncate font-medium">
                    {selectedCollection.name}
                  </span>
                </>
              ) : selectedInboxSpaceId ? (
                <>
                  <Inbox
                    className="h-3.5 w-3.5 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">Inbox (auto)</span>
                </>
              ) : (
                <span className="truncate text-fg-muted">
                  Choose collection...
                </span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              {selectedSpaceName && (
                <span className="max-w-[74px] truncate rounded border border-hairline bg-canvas/80 px-1.5 py-0.25 font-mono text-[9px] text-fg-muted">
                  {selectedSpaceName}
                </span>
              )}
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-fg-muted"
                aria-hidden="true"
              />
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          collisionPadding={10}
          className="max-h-[264px] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] overflow-y-auto border-border bg-[var(--stash-panel)] shadow-2xl"
        >
          {groupedBySpace.map(({ space, cols, showAutoInbox }, groupIdx) => {
            if (cols.length === 0 && !showAutoInbox) return null;
            const SpaceIcon = getCuratedCollectionIcon(space.icon) ?? Layers;
            return (
              <div key={space.id}>
                {multiSpace && (
                  <>
                    {groupIdx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="flex items-center gap-1.5 py-1 font-mono text-[10px]">
                      <SpaceIcon
                        className="h-3 w-3 shrink-0 opacity-75"
                        aria-hidden="true"
                      />
                      <span className="truncate">{space.name}</span>
                    </DropdownMenuLabel>
                  </>
                )}

                {showAutoInbox && (
                  <DropdownMenuItem
                    onSelect={() =>
                      onSelectCollection(makeSpaceInboxValue(space.id))
                    }
                    className="justify-between"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Inbox className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="truncate">Inbox (auto)</span>
                    </span>
                    {selectedCollectionId === makeSpaceInboxValue(space.id) && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                    )}
                  </DropdownMenuItem>
                )}

                {cols.map((col) => {
                  const isSelected = col.id === selectedCollectionId;
                  return (
                    <DropdownMenuItem
                      key={col.id}
                      onSelect={() => onSelectCollection(col.id)}
                      className="justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CollectionGlyph collection={col} />
                        <span className="truncate">{col.name}</span>
                      </span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            );
          })}

          <DropdownMenuSeparator />

          {suggestion?.suggestedNewCollection && (
            <DropdownMenuItem
              onSelect={() =>
                onCreateCollection(suggestion.suggestedNewCollection ?? '')
              }
              className="text-accent focus:text-accent"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Create "{suggestion.suggestedNewCollection}"
              </span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={() => onChangeCreatingName('')}
            className="text-fg-muted focus:text-fg"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>New collection...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline New Collection Creator */}
      {creatingName !== null && (
        <div className="flex items-center gap-1 pt-0.5">
          <Input
            value={creatingName}
            onChange={(e) => onChangeCreatingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCreateCollection(creatingName);
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                onChangeCreatingName(null);
              }
            }}
            placeholder="New collection name..."
            aria-label="New collection name"
            className="h-7 flex-1 text-xs"
            autoFocus
          />
          <button
            type="button"
            disabled={!creatingName.trim()}
            onClick={() => onCreateCollection(creatingName)}
            className="inline-flex h-7 shrink-0 items-center rounded-control border border-border bg-elevated px-2.5 text-[11px] font-medium text-fg transition-colors hover:border-accent/50 hover:text-accent disabled:pointer-events-none disabled:opacity-45 cursor-pointer"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => onChangeCreatingName(null)}
            aria-label="Cancel new collection"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-card-hover hover:text-fg cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
