import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { extractDomain, getMonogram } from '@/lib/utils/url';

export interface TriageRowCardProps {
  link: LinkItem;
  suggestion: CategorizationSuggestion;
  destination: string;
  newPrefix: string;
  createCustomSentinel: string;
  isCreatingCustom: boolean;
  customDraft: string;
  availableNewCategories: readonly string[];
  destinationCollections: readonly Collection[];
  onChangeCustomDraft: (value: string) => void;
  onCommitCustomCategory: () => void;
  onCancelCustomCategory: () => void;
  onChangeDestination: (value: string) => void;
}

export function TriageRowCard({
  link,
  suggestion,
  destination,
  newPrefix,
  createCustomSentinel,
  isCreatingCustom,
  customDraft,
  availableNewCategories,
  destinationCollections,
  onChangeCustomDraft,
  onCommitCustomCategory,
  onCancelCustomCategory,
  onChangeDestination,
}: TriageRowCardProps) {
  const isNewDest = destination.startsWith(newPrefix);

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-border bg-canvas p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-panel font-mono text-[10px] font-semibold text-accent">
          {link.faviconUrl ? (
            <img
              src={link.faviconUrl}
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5 object-contain"
            />
          ) : (
            <span>{getMonogram(link.title, link.url)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-fg">
            {link.title}
          </div>
          <div className="truncate font-mono text-[10px] text-fg-muted">
            {extractDomain(link.url)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
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
          </div>
        </div>
      </div>

      <div className="w-full shrink-0 sm:w-56">
        {isCreatingCustom ? (
          <div className="flex items-center gap-1">
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
          <Select
            aria-label={`Destination for ${link.title}`}
            value={destination}
            onChange={(e) => onChangeDestination(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="">Keep in session</option>
            {availableNewCategories.map((name) => (
              <option key={name} value={`${newPrefix}${name}`}>
                + Create &ldquo;{name}&rdquo;
              </option>
            ))}
            {destinationCollections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
            <option value={createCustomSentinel}>
              + Custom new category...
            </option>
          </Select>
        )}
      </div>
    </div>
  );
}
