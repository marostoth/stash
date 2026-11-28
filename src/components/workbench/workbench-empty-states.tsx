import { FolderPlus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const WORKBENCH_TOASTER_STYLE = {
  background: 'var(--stash-panel)',
  color: 'var(--stash-text)',
  border: '1px solid var(--stash-border)',
  borderRadius: 'var(--stash-radius-card)',
} as const;

export function EmptySpaceNotice({
  spaceName,
  onCreateCollection,
}: {
  spaceName: string;
  onCreateCollection: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-card border border-dashed border-border bg-panel/70 px-6 py-12 text-center">
      <FolderPlus className="mb-3 h-7 w-7 text-accent" />
      <p className="text-sm font-medium text-fg">
        No collections in {spaceName} yet
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        Create a collection here, or drag any card, tab, or collection onto the{' '}
        {spaceName} tab above.
      </p>
      <Button
        variant="primary"
        size="sm"
        onClick={onCreateCollection}
        className="mt-4"
      >
        New Collection
      </Button>
    </div>
  );
}

export function NoFilterMatchesNotice({
  starredOnly,
  searchQuery,
  searchAllSpaces,
  spacesCount,
  onClear,
}: {
  starredOnly: boolean;
  searchQuery: string;
  searchAllSpaces: boolean;
  spacesCount: number;
  onClear: () => void;
}) {
  const trimmed = searchQuery.trim();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-card border border-border bg-panel px-6 py-12 text-center">
      <SearchX className="mb-3 h-7 w-7 text-fg-muted" />
      <p className="text-sm font-medium text-fg">
        {starredOnly && !trimmed
          ? 'No starred links yet'
          : starredOnly
            ? `No starred matches for "${trimmed}"`
            : trimmed
              ? `No matches for "${trimmed}"`
              : 'No links match the active view'}
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        {starredOnly && !trimmed
          ? 'Star any link card to highlight it and filter it here.'
          : !searchAllSpaces && spacesCount > 1
            ? 'Filtering active Space only. Enable "All Spaces" to search every board.'
            : 'Try clearing filters or searching by domain, title, tag, or note.'}
      </p>
      <Button variant="secondary" size="sm" onClick={onClear} className="mt-4">
        {starredOnly && !trimmed ? 'Show All Links' : 'Clear Filters'}
      </Button>
    </div>
  );
}
