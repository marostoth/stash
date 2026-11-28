import {
  ArrowRight,
  Folder,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AiActivityPanel } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { filterIconCatalog, getCatalogIcon } from '@/lib/icons/catalog';
import type { ProposedCategory } from '@/lib/reorganize/digest';
import { cn } from '@/lib/utils/cn';

interface CategoryCheckpointProps {
  categories: readonly ProposedCategory[];
  scopedLinksCount: number;
  regenerating: boolean;
  errorMessage: string | null;
  onUpdateCategory: (
    id: string,
    patch: { name?: string; description?: string; icon?: string },
  ) => void;
  onDeleteCategory: (id: string) => void;
  onAddCategory: () => void;
  onRegenerate: () => void;
  onMinimizeRegenerate?: () => void;
  onCancelRegenerate: () => void;
  onBack: () => void;
  onStartSort: () => void;
}

const MAX_CATEGORIES = 10;

interface CategoryIconPickerButtonProps {
  iconKey?: string;
  categoryName: string;
  onSelect: (iconKey: string | undefined) => void;
}

function CategoryIconPickerButton({
  iconKey,
  categoryName,
  onSelect,
}: CategoryIconPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [open]);

  const filtered = useMemo(() => filterIconCatalog(query), [query]);
  const ActiveIcon = getCatalogIcon(iconKey) ?? Folder;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Choose icon for ${categoryName || 'category'}`}
        aria-expanded={open}
        title={iconKey ? `Icon: ${iconKey} (click to change)` : 'Choose icon'}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border transition-colors cursor-pointer',
          iconKey
            ? 'border-accent/45 bg-accent/10 text-accent hover:bg-accent/20'
            : 'border-border bg-panel text-fg-muted hover:border-accent/45 hover:text-fg',
        )}
      >
        <ActiveIcon className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-64 space-y-2 rounded-card border border-border bg-panel p-2.5 shadow-xl">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons..."
                aria-label="Search icons"
                autoFocus
                className="h-7 pl-6.5 pr-2 text-[11px]"
              />
            </div>
            {iconKey ? (
              <button
                type="button"
                onClick={() => {
                  onSelect(undefined);
                  setOpen(false);
                }}
                title="Clear icon"
                aria-label="Clear icon"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border text-fg-muted hover:text-fg cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <p className="py-2 text-center font-mono text-[10px] text-fg-muted">
              No matching icons
            </p>
          ) : (
            <div className="grid max-h-36 grid-cols-6 gap-1 overflow-y-auto pr-0.5">
              {filtered.map(({ key, label, Icon }) => {
                const selected = iconKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onSelect(key);
                      setOpen(false);
                    }}
                    title={label}
                    aria-label={label}
                    className={cn(
                      'flex h-7 w-full items-center justify-center rounded-control border transition-colors cursor-pointer',
                      selected
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-transparent bg-canvas text-fg-muted hover:border-border hover:text-fg',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryCheckpoint({
  categories,
  scopedLinksCount,
  regenerating,
  errorMessage,
  onUpdateCategory,
  onDeleteCategory,
  onAddCategory,
  onRegenerate,
  onMinimizeRegenerate,
  onCancelRegenerate,
  onBack,
  onStartSort,
}: CategoryCheckpointProps) {
  const validCategories = categories.filter((c) => c.name.trim().length > 0);
  const canAddMore = categories.length < MAX_CATEGORIES;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          Review, rename, pick icons, or trim Gemini Nano&apos;s proposed
          buckets before sorting. Unmatched links safely route to{' '}
          <span className="font-mono text-fg">Uncategorized</span>.
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={regenerating}
            onClick={onRegenerate}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-accent ${regenerating ? 'animate-spin' : ''}`}
            />
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canAddMore || regenerating}
            onClick={onAddCategory}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}

      {regenerating ? (
        <AiActivityPanel
          title="Regenerating category proposals..."
          subtitle={`Re-evaluating ${scopedLinksCount} ${scopedLinksCount === 1 ? 'link' : 'links'} with Gemini Nano`}
          showElapsed
          skeletonRows={4}
          onMinimize={onMinimizeRegenerate}
          onCancel={onCancelRegenerate}
        />
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="grid gap-2 rounded-card border border-border bg-canvas p-3 sm:grid-cols-[auto_170px_1fr_auto] sm:items-center"
            >
              <CategoryIconPickerButton
                iconKey={cat.icon}
                categoryName={cat.name}
                onSelect={(nextIcon) =>
                  onUpdateCategory(cat.id, { icon: nextIcon })
                }
              />
              <Input
                value={cat.name}
                maxLength={40}
                placeholder={`Category ${idx + 1}`}
                aria-label={`Category ${idx + 1} name`}
                onChange={(e) =>
                  onUpdateCategory(cat.id, { name: e.target.value })
                }
                className="h-8 text-xs font-medium"
              />
              <Input
                value={cat.description}
                maxLength={120}
                placeholder="Short description of what belongs here..."
                aria-label={`Category ${idx + 1} description`}
                onChange={(e) =>
                  onUpdateCategory(cat.id, { description: e.target.value })
                }
                className="h-8 text-xs text-fg-muted"
              />
              <button
                type="button"
                onClick={() => onDeleteCategory(cat.id)}
                disabled={categories.length <= 1}
                aria-label={`Remove ${cat.name || 'category'}`}
                title="Remove category"
                className="inline-flex h-8 w-8 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-panel hover:text-danger disabled:opacity-35 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to Scope
        </Button>

        <Button
          variant="primary"
          size="sm"
          disabled={regenerating || validCategories.length === 0}
          onClick={onStartSort}
          className="gap-1.5"
        >
          Sort {scopedLinksCount} {scopedLinksCount === 1 ? 'Link' : 'Links'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
