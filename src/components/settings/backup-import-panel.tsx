import {
  Bookmark,
  Download,
  FileCode2,
  FolderSync,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { parseNetscapeBookmarksHtml } from '@/lib/import-export/bookmarks-html';
import {
  buildExportBundle,
  formatBackupFilename,
  validateExportBundle,
} from '@/lib/import-export/bundle';
import {
  readChromeBookmarksWithPermission,
  triggerFileDownload,
} from '@/lib/import-export/chrome-bookmarks';
import { stashRepo } from '@/lib/storage/repo';
import type { StashExportBundle } from '@/lib/types/stash';

export function BackupImportPanel() {
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const htmlInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingBundle, setPendingBundle] = useState<StashExportBundle | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const handleExportJson = async () => {
    const snapshot = await stashRepo.getSnapshot();
    const bundle = buildExportBundle(snapshot);
    const filename = formatBackupFilename();
    triggerFileDownload(filename, `${JSON.stringify(bundle, null, 2)}\n`);
    toast.success(`Exported ${filename}`);
  };

  const handleSelectBackupFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validated = validateExportBundle(parsed);
      if (!validated.ok) {
        toast.error(validated.error);
        return;
      }
      setPendingBundle(validated.bundle);
    } catch {
      toast.error('Could not parse JSON backup file.');
    }
  };

  const handleRestore = async (mode: 'merge' | 'replace') => {
    if (!pendingBundle || busy) return;
    setBusy(true);
    try {
      const stats = await stashRepo.restoreBundle(pendingBundle, mode);
      setPendingBundle(null);
      if (mode === 'replace') {
        toast.success(
          `Restored ${stats.addedCollections} collections and ${stats.addedLinks} links.`,
        );
      } else {
        toast.success(
          `Merged +${stats.addedCollections} collections, +${stats.addedLinks} links (${stats.skippedLinks} duplicates skipped).`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImportChromeBookmarks = async () => {
    if (busy) return;
    setBusy(true);
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
        `Imported ${summary.linksAdded} bookmarks across ${summary.collectionsCreated} new collection${summary.collectionsCreated === 1 ? '' : 's'}${summary.linksSkipped > 0 ? ` (${summary.linksSkipped} duplicates skipped)` : ''}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSelectHtmlFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;

    setBusy(true);
    try {
      const html = await file.text();
      const folders = parseNetscapeBookmarksHtml(html);
      if (folders.length === 0) {
        toast.error('No valid bookmarks found in that HTML file.');
        return;
      }
      const summary = await stashRepo.importBookmarkFolders(folders);
      toast.success(
        `Imported ${summary.linksAdded} bookmarks across ${summary.collectionsCreated} new collection${summary.collectionsCreated === 1 ? '' : 's'}${summary.linksSkipped > 0 ? ` (${summary.linksSkipped} duplicates skipped)` : ''}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* JSON Backup & Restore */}
      <div className="space-y-3 rounded-card border border-border bg-canvas p-4">
        <div className="flex items-center gap-2">
          <FolderSync className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold text-fg">
            JSON Backup &amp; Restore (schemaVersion 1)
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          Export your entire Stash library—collections, links, notes, tags,
          rules, settings, and custom themes—as a single portable JSON file.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleExportJson()}
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON Backup
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => jsonInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Import JSON Backup
          </Button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleSelectBackupFile(e)}
            className="hidden"
          />
        </div>

        {pendingBundle && (
          <div className="space-y-2.5 rounded-control border border-accent/45 bg-panel p-3">
            <div className="text-xs font-medium text-fg">
              Ready to import backup:
            </div>
            <div className="font-mono text-[11px] text-fg-muted">
              {pendingBundle.collections.length} collections ·{' '}
              {pendingBundle.links.length} links · {pendingBundle.rules.length}{' '}
              rules · {pendingBundle.customThemes.length} custom themes
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => void handleRestore('merge')}
              >
                Merge (Skip Duplicates)
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => void handleRestore('replace')}
              >
                Replace All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setPendingBundle(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bookmark Importers */}
      <div className="space-y-3 rounded-card border border-border bg-canvas p-4">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold text-fg">Import Bookmarks</h3>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          Bring existing bookmarks into Stash collections. Duplicate URLs within
          a collection are automatically skipped.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void handleImportChromeBookmarks()}
          >
            <Bookmark className="h-3.5 w-3.5 text-accent" />
            Import Chrome Bookmarks
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => htmlInputRef.current?.click()}
          >
            <FileCode2 className="h-3.5 w-3.5 text-fg-muted" />
            Import HTML File (.html)
          </Button>
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => void handleSelectHtmlFile(e)}
            className="hidden"
          />
        </div>
        <p className="font-mono text-[10px] text-fg-muted">
          Direct Chrome import requests optional bookmarks permission on click.
          HTML import supports Chrome, Edge, Firefox, and Toby exports.
        </p>
      </div>
    </div>
  );
}
