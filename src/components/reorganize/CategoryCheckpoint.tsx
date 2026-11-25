import { ArrowRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProposedCategory } from '@/lib/reorganize/digest';

interface CategoryCheckpointProps {
  categories: readonly ProposedCategory[];
  scopedLinksCount: number;
  regenerating: boolean;
  errorMessage: string | null;
  onUpdateCategory: (
    id: string,
    patch: { name?: string; description?: string },
  ) => void;
  onDeleteCategory: (id: string) => void;
  onAddCategory: () => void;
  onRegenerate: () => void;
  onBack: () => void;
  onStartSort: () => void;
}

const MAX_CATEGORIES = 10;

export function CategoryCheckpoint({
  categories,
  scopedLinksCount,
  regenerating,
  errorMessage,
  onUpdateCategory,
  onDeleteCategory,
  onAddCategory,
  onRegenerate,
  onBack,
  onStartSort,
}: CategoryCheckpointProps) {
  const validCategories = categories.filter((c) => c.name.trim().length > 0);
  const canAddMore = categories.length < MAX_CATEGORIES;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          Review, rename, or trim Gemini Nano&apos;s proposed buckets before
          sorting. Unmatched links will safely route to{' '}
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

      <div className="space-y-2">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className="grid gap-2 rounded-card border border-border bg-canvas p-3 sm:grid-cols-[180px_1fr_auto] sm:items-center"
          >
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
