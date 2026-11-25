import { Check, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { UNCATEGORIZED_CATEGORY_NAME } from '@/lib/reorganize/digest';
import type { ReorganizeSummary } from '@/lib/reorganize/plan';
import type { LinkItem } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';

interface PreviewPlanStepProps {
  scopedLinks: readonly LinkItem[];
  assignments: Readonly<Record<string, string>>;
  targetCategoryOptions: readonly string[];
  summary: ReorganizeSummary;
  applying: boolean;
  onOverrideAssignment: (linkId: string, categoryName: string) => void;
  onBackToCategories: () => void;
  onApply: () => void;
}

export function PreviewPlanStep({
  scopedLinks,
  assignments,
  targetCategoryOptions,
  summary,
  applying,
  onOverrideAssignment,
  onBackToCategories,
  onApply,
}: PreviewPlanStepProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const groupedLinks = useMemo(() => {
    const groups = new Map<string, LinkItem[]>();
    for (const option of targetCategoryOptions) {
      groups.set(option, []);
    }

    for (const link of scopedLinks) {
      const assigned = assignments[link.id] || UNCATEGORIZED_CATEGORY_NAME;
      const bucket = groups.get(assigned);
      if (bucket) {
        bucket.push(link);
      } else {
        groups.set(assigned, [link]);
      }
    }

    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [scopedLinks, assignments, targetCategoryOptions]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Compact Summary Strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-accent/35 bg-accent/10 px-3.5 py-2.5 font-mono text-[11px] text-fg">
        <span>
          <strong>{summary.movedLinks}</strong> links →{' '}
          <strong>{summary.targetCollectionsCount}</strong> collections
        </span>
        {summary.createdCollections > 0 ? (
          <span className="text-fg-muted">
            · +{summary.createdCollections} new
          </span>
        ) : null}
        {summary.deduplicatedLinks > 0 ? (
          <span className="text-fg-muted">
            · {summary.deduplicatedLinks} duplicate
            {summary.deduplicatedLinks === 1 ? '' : 's'} skipped
          </span>
        ) : null}
        {summary.removedEmptyCollections > 0 ? (
          <span className="text-fg-muted">
            · {summary.removedEmptyCollections} empty source
            {summary.removedEmptyCollections === 1 ? '' : 's'} removed
          </span>
        ) : null}
      </div>

      {/* Collapsible Target Groups */}
      <div className="space-y-2.5">
        {groupedLinks.map(([categoryName, items]) => {
          const isCollapsed = collapsedGroups.has(categoryName);
          return (
            <section
              key={categoryName}
              className="rounded-card border border-border bg-canvas"
            >
              <button
                type="button"
                onClick={() => toggleGroup(categoryName)}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-fg-muted" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-fg-muted" />
                  )}
                  <FolderTree className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-semibold text-fg">
                    {categoryName}
                  </span>
                </span>
                <span className="rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg-muted">
                  {items.length}
                </span>
              </button>

              {!isCollapsed ? (
                <ul className="divide-y divide-border/60 border-t border-border">
                  {items.map((link) => (
                    <li
                      key={link.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-fg">
                          {link.title}
                        </div>
                        <div className="truncate font-mono text-[10px] text-fg-muted">
                          {extractDomain(link.url)}
                        </div>
                      </div>

                      <Select
                        value={
                          assignments[link.id] || UNCATEGORIZED_CATEGORY_NAME
                        }
                        aria-label={`Target collection for ${link.title}`}
                        onChange={(e) =>
                          onOverrideAssignment(link.id, e.target.value)
                        }
                        className="h-7 w-44 shrink-0 text-[11px]"
                      >
                        {targetCategoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel pt-3 pb-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={applying}
          onClick={onBackToCategories}
        >
          ← Back to Categories
        </Button>

        <Button
          variant="primary"
          size="sm"
          disabled={applying || scopedLinks.length === 0}
          onClick={onApply}
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {applying ? 'Applying...' : 'Apply Reorganization'}
        </Button>
      </div>
    </div>
  );
}
