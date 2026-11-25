import { ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { LinkFavicon } from '@/components/LinkFavicon';
import type { LinkItem } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';

export interface HealthTriageRow {
  link: LinkItem;
  collectionName: string;
  reason: string;
}

interface HealthGroupSectionProps {
  title: string;
  description: string;
  tone: 'danger' | 'warning' | 'neutral';
  icon: ReactNode;
  rows: readonly HealthTriageRow[];
  selectedIds: ReadonlySet<string>;
  defaultExpanded?: boolean;
  onToggleItem: (linkId: string) => void;
  onSelectAll: (ids: readonly string[]) => void;
  onSelectNone: (ids: readonly string[]) => void;
}

function HealthRowFavicon({ link }: { link: LinkItem }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-panel">
      <LinkFavicon url={link.url} faviconUrl={link.faviconUrl} size="sm" />
    </span>
  );
}

export function HealthGroupSection({
  title,
  description,
  tone,
  icon,
  rows,
  selectedIds,
  defaultExpanded = true,
  onToggleItem,
  onSelectAll,
  onSelectNone,
}: HealthGroupSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (rows.length === 0) return null;

  const rowIds = rows.map((r) => r.link.id);
  const selectedCount = rows.reduce(
    (sum, r) => sum + (selectedIds.has(r.link.id) ? 1 : 0),
    0,
  );

  const badgeClass =
    tone === 'danger'
      ? 'border-danger/40 bg-danger/15 text-danger'
      : tone === 'warning'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
        : 'border-border bg-panel text-fg-muted';

  const reasonPillClass =
    tone === 'danger'
      ? 'border-danger/35 bg-danger/10 text-danger'
      : tone === 'warning'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-400'
        : 'border-border bg-panel text-fg-muted';

  return (
    <section className="rounded-card border border-border bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
          )}
          {icon}
          <span className="text-xs font-semibold text-fg">{title}</span>
          <span
            className={cn(
              'rounded-pill border px-1.5 py-0.5 font-mono text-[10px]',
              badgeClass,
            )}
          >
            {rows.length}
          </span>
          {selectedCount > 0 ? (
            <span className="font-mono text-[10px] text-fg-muted">
              ({selectedCount} selected)
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectAll(rowIds)}
            className="rounded-control px-1.5 py-0.5 font-mono text-[10px] text-fg-muted transition-colors hover:bg-panel hover:text-fg cursor-pointer"
          >
            Select All
          </button>
          <span className="text-border">·</span>
          <button
            type="button"
            onClick={() => onSelectNone(rowIds)}
            className="rounded-control px-1.5 py-0.5 font-mono text-[10px] text-fg-muted transition-colors hover:bg-panel hover:text-fg cursor-pointer"
          >
            None
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border">
          <p className="border-b border-border/60 bg-panel/40 px-3.5 py-1.5 text-[11px] text-fg-muted">
            {description}
          </p>
          <ul className="divide-y divide-border/60">
            {rows.map(({ link, collectionName, reason }) => {
              const checked = selectedIds.has(link.id);
              return (
                <li
                  key={link.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2 transition-colors',
                    checked ? 'bg-accent/5' : 'hover:bg-panel/40',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleItem(link.id)}
                    aria-label={`Select ${link.title}`}
                    className="h-3.5 w-3.5 shrink-0 accent-[var(--stash-accent)] cursor-pointer"
                  />

                  <HealthRowFavicon link={link} />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-fg">
                      {link.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
                      <span className="truncate font-mono text-[10px]">
                        {extractDomain(link.url)}
                      </span>
                      <span className="rounded-pill border border-border bg-panel px-1.5 py-0.25 text-[10px] text-fg-muted">
                        {collectionName}
                      </span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'shrink-0 rounded-pill border px-2 py-0.5 font-mono text-[10px]',
                      reasonPillClass,
                    )}
                  >
                    {reason}
                  </span>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${link.url} in new tab`}
                    aria-label={`Verify ${link.title} in new tab`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-panel hover:text-fg"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
