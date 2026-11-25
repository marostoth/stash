import { Bookmark, FileCode2, FolderPlus, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { parseNetscapeBookmarksHtml } from '@/lib/import-export/bookmarks-html';
import { readChromeBookmarksWithPermission } from '@/lib/import-export/chrome-bookmarks';
import { stashRepo } from '@/lib/storage/repo';
import { useUiStore } from '@/store/ui-store';

export function EmptyState() {
  const openCreateCollection = useUiStore((s) => s.openCreateCollection);
  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const handleSeedStarters = async () => {
    const seeded = await stashRepo.seedStarterCollections();
    toast.success(`Created ${seeded.length} starter collections`);
  };

  const handleImportChromeBookmarks = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await readChromeBookmarksWithPermission();
      if (!result.ok) {
        toast.info(result.message);
        return;
      }
      if (result.folders.length === 0) {
        toast.info('No web bookmarks found in Chrome.');
        return;
      }
      const summary = await stashRepo.importBookmarkFolders(result.folders);
      toast.success(
        `Imported ${summary.linksAdded} bookmarks into ${summary.collectionsCreated} collection${summary.collectionsCreated === 1 ? '' : 's'}`,
      );
    } finally {
      setImporting(false);
    }
  };

  const handleImportHtmlFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || importing) return;

    setImporting(true);
    try {
      const html = await file.text();
      const folders = parseNetscapeBookmarksHtml(html);
      if (folders.length === 0) {
        toast.error('No valid bookmarks found in that HTML file.');
        return;
      }
      const summary = await stashRepo.importBookmarkFolders(folders);
      toast.success(
        `Imported ${summary.linksAdded} bookmarks into ${summary.collectionsCreated} collection${summary.collectionsCreated === 1 ? '' : 's'}`,
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-11rem)] max-w-xl flex-col items-center justify-center text-center">
      <div className="w-full rounded-card border border-border bg-panel p-8 shadow-lg">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-card border border-border bg-card">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="5" rx="1.2" />
            <rect x="3" y="12" width="11" height="8" rx="1.2" />
            <path d="M18 13.5v5M15.5 16h5" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Welcome to Stash
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-muted">
          A fast, local-first workbench for your bookmarks and working links.
          Import your existing browser bookmarks or start fresh with your first
          collection.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button
            variant="primary"
            disabled={importing}
            onClick={() => void handleImportChromeBookmarks()}
            className="w-full sm:w-auto"
          >
            <Bookmark className="h-4 w-4" />
            Import Chrome Bookmarks
          </Button>
          <Button
            variant="secondary"
            onClick={openCreateCollection}
            className="w-full sm:w-auto"
          >
            <FolderPlus className="h-4 w-4 text-accent" />
            Create First Collection
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-4">
          <button
            type="button"
            disabled={importing}
            onClick={() => htmlInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent cursor-pointer"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Upload .html bookmarks
          </button>
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => void handleImportHtmlFile(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => void handleSeedStarters()}
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Seed 3 starter collections
          </button>
        </div>
      </div>
    </section>
  );
}
