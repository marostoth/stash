import { Check, RotateCcw, Trash2, X } from 'lucide-react';
import { LinkFavicon } from '@/components/LinkFavicon';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { SpaceGroupedCollectionOptions } from '@/components/ui/space-grouped-collection-options';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import type { Collection, LinkItem, Space } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';

export interface TriageRowCardProps {
  link: LinkItem;
  suggestion: CategorizationSuggestion;
  destination: string;
  newPrefix: string;
  createCustomSentinel: string;
  deleteSentinel: string;
  isCreatingCustom: boolean;
  customDraft: string;
  availableNewCategories: readonly string[];
  destinationCollections: readonly Collection[];
  spaces: readonly Space[];
  onChangeCustomDraft: (value: string) => void;
  onCommitCustomCategory: () => void;
  onCancelCustomCategory: () => void;
  onChangeDestination: (value: string) => void;
  onToggleDiscard: () => void;
}

export function TriageRowCard({
  link,
  suggestion,
  destination,
  newPrefix,
  createCustomSentinel,
  deleteSentinel,
  isCreatingCustom,
  customDraft,
  availableNewCategories,
  destinationCollections,
  spaces,
  onChangeCustomDraft,
  onCommitCustomCategory,
  onCancelCustomCategory,
  onChangeDestination,
  onToggleDiscard,
}: TriageRowCardProps) {
  const isNewDest = destination.startsWith(newPrefix);
  const isMarkedDelete = destination === deleteSentinel;

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-card border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
        isMarkedDelete
          ? 'border-danger/45 bg-danger/5'
          : 'border-border bg-canvas',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-panel',
            isMarkedDelete && 'opacity-50',
          )}
        >
          <LinkFavicon url={link.url} faviconUrl={link.faviconUrl} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-xs font-medium',
              isMarkedDelete ? 'text-fg-muted line-through' : 'text-fg',
            )}
          >
            {link.title}
          </div>
          <div className="truncate font-mono text-[10px] text-fg-muted">
            {extractDomain(link.url)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {isMarkedDelete ? (
              <span className="rounded-pill border border-danger/40 bg-danger/10 px-1.5 py-0.5 font-mono text-[10px] text-danger">
                Will delete
              </span>
            ) : (
              <>
                {suggestion.source === 'rule' && (
                  <span className="rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                    Rule: {suggestion.matchedRuleName}
                  </span>
                )}
                {suggestion.source === 'nano' && (
                  <span className="rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                    On-Device AI
                  </span>
                )}
                {isNewDest && (
                  <span className="rounded-pill border border-accent/40 bg-panel px-1.5 py-0.5 font-mono text-[10px] text-accent">
                    New category
                  </span>
                )}
                {suggestion.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-64">
        {isCreatingCustom ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              value={customDraft}
              onChange={(e) => onChangeCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCommitCustomCategory();
                } else if (e.key === 'Escape') {
                  onCancelCustomCategory();
                }
              }}
              placeholder="Category name..."
              className="h-8 text-xs"
              autoFocus
            />
            <Button
              variant="primary"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Confirm new category"
              onClick={onCommitCustomCategory}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Cancel new category"
              onClick={onCancelCustomCategory}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <Select
              aria-label={`Destination for ${link.title}`}
              value={destination}
              onChange={(e) => onChangeDestination(e.target.value)}
              className={cn(
                'h-8 min-w-0 flex-1 text-xs',
                isMarkedDelete && 'border-danger/45 text-danger',
              )}
            >
              <option value="">Keep in session</option>
              <option value={deleteSentinel}>Delete from session</option>
              {availableNewCategories.map((name) => (
                <option key={name} value={`${newPrefix}${name}`}>
                  + Create &ldquo;{name}&rdquo;
                </option>
              ))}
              <SpaceGroupedCollectionOptions
                collections={destinationCollections}
                spaces={spaces}
              />
              <option value={createCustomSentinel}>
                + Custom new category...
              </option>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleDiscard}
              aria-label={
                isMarkedDelete
                  ? `Restore ${link.title}`
                  : `Discard ${link.title} from session`
              }
              title={
                isMarkedDelete
                  ? 'Undo delete (restore row)'
                  : 'Discard from session'
              }
              className={cn(
                'h-8 w-8 shrink-0',
                isMarkedDelete
                  ? 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20'
                  : 'text-fg-muted hover:bg-danger/10 hover:text-danger',
              )}
            >
              {isMarkedDelete ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
