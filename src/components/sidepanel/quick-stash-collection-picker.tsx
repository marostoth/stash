import { Check, Loader2, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { SpaceGroupedCollectionOptions } from '@/components/ui/space-grouped-collection-options';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import {
  type Collection,
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
    return 'Matched from library';
  }
  return suggestion.collectionId ? 'On-Device AI' : 'AI tags · Pick collection';
}

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
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          Collection
        </span>
        {categorizing ? (
          <span className="inline-flex items-center gap-1 rounded-pill border border-accent/45 bg-accent/12 px-2 py-0.5 font-mono text-[10px] text-accent">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            AI matching...
          </span>
        ) : suggestion && suggestion.source !== 'none' ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 font-mono text-[10px]',
              suggestion.collectionId
                ? 'border-accent/35 bg-accent/10 text-accent'
                : 'border-border bg-canvas text-fg-muted',
            )}
          >
            {enrichingTags ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Sparkles className="h-2.5 w-2.5" />
            )}
            {getSuggestionBadgeLabel(suggestion)}
          </span>
        ) : null}
      </div>

      {spaces.length > 1 && orderedCollections.length > 0 ? (
        <Select
          aria-label="Target collection"
          value={selectedCollectionId}
          onChange={(e) => onSelectCollection(e.target.value)}
          className={cn(
            'h-8 text-xs transition-colors',
            categorizing && 'border-accent/45 text-fg-muted',
          )}
        >
          <SpaceGroupedCollectionOptions
            collections={orderedCollections}
            spaces={spaces}
          />
        </Select>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {spaces.length <= 1 &&
          orderedCollections.map((col) => {
            const isSelected = col.id === selectedCollectionId;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onSelectCollection(col.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'border-accent bg-accent/15 text-fg ring-1 ring-accent/40'
                    : 'border-border bg-canvas text-fg-muted hover:border-fg-muted/40 hover:text-fg',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: TAB_GROUP_COLOR_SWATCH[col.color],
                  }}
                />
                <span className="max-w-[130px] truncate">{col.name}</span>
                {isSelected && <Check className="h-3 w-3 text-accent" />}
              </button>
            );
          })}

        {suggestion?.suggestedNewCollection && (
          <button
            type="button"
            onClick={() =>
              onCreateCollection(suggestion.suggestedNewCollection ?? '')
            }
            className="inline-flex items-center gap-1 rounded-pill border border-dashed border-accent/60 bg-accent/10 px-2.5 py-1 text-[11px] text-accent hover:bg-accent/20 cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            Create "{suggestion.suggestedNewCollection}"
          </button>
        )}

        {creatingName === null ? (
          <button
            type="button"
            onClick={() => onChangeCreatingName('')}
            className="inline-flex items-center gap-1 rounded-pill border border-dashed border-border px-2 py-1 text-[11px] text-fg-muted hover:border-accent/50 hover:text-fg cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        ) : (
          <div className="flex w-full items-center gap-1 pt-1">
            <Input
              value={creatingName}
              onChange={(e) => onChangeCreatingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCreateCollection(creatingName);
                } else if (e.key === 'Escape') {
                  onChangeCreatingName(null);
                }
              }}
              placeholder="New collection name..."
              className="h-7 text-xs"
              autoFocus
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2"
              onClick={() => onCreateCollection(creatingName)}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
